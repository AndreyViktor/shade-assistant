import { spawn } from 'node:child_process';
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptions,
} from 'node:child_process';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { NativeJsonlDecoder } from '../../../contracts/native/NativeJsonlDecoder';
import {
  encodeNativeCommand,
  NativeProtocolError,
} from '../../../contracts/native/protocol';
import type {
  AudioSource,
  NativeCommand,
  NativeErrorCode,
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../../contracts/native/protocol';
import type { TranscriptionProvider } from '../../../core/transcription/TranscriptionProvider';

const STARTUP_TIMEOUT_MS = 20_000;
const COMMAND_TIMEOUT_MS = 5_000;
const STOP_TIMEOUT_MS = 7_000;
const TERMINATE_TIMEOUT_MS = 1_500;
const MAX_STDERR_BYTES = 16_384;

type ChannelState =
  'initial' | 'ready' | 'listening' | 'paused' | 'error' | 'stopped';
type SafeFailureCode =
  | NativeErrorCode
  | 'aborted'
  | 'helper-unavailable'
  | 'transport-failed'
  | 'protocol-failed'
  | 'timeout';

export class AppleNativeTranscriptionError extends Error {
  constructor(readonly code: SafeFailureCode) {
    super(`Apple native transcription failed: ${code}`);
    this.name = 'AppleNativeTranscriptionError';
  }
}

type ExitResult = { code: number | null; signal: NodeJS.Signals | null };
type StateWaiter = {
  check: () => void;
  finish: (error?: Error) => void;
};
type ActiveProcess = {
  child: ChildProcessWithoutNullStreams;
  decoder: NativeJsonlDecoder;
  config: TranscriptionConfig;
  onEvent: (event: TranscriptionEvent) => void;
  states: Map<AudioSource, ChannelState>;
  waiters: Set<StateWaiter>;
  writeQueue: Promise<void>;
  close: Promise<ExitResult>;
  resolveClose: (result: ExitResult) => void;
  closeResult?: ExitResult;
  failure?: AppleNativeTranscriptionError;
  stderrBytes: number;
  stopPromise?: Promise<void>;
  closedCleanly: boolean;
};

type ProviderOptions = {
  resolveExecutable: () => Promise<string>;
  spawnProcess?: (
    executable: string,
    options: SpawnOptions,
  ) => ChildProcessWithoutNullStreams;
  startupTimeoutMs?: number;
  commandTimeoutMs?: number;
  stopTimeoutMs?: number;
  terminateTimeoutMs?: number;
};

/** Owns exactly one helper process and validates every stdout frame before delivery. */
export class AppleNativeTranscriptionProvider implements TranscriptionProvider {
  private active?: ActiveProcess;
  private readonly spawnProcess: NonNullable<ProviderOptions['spawnProcess']>;

  constructor(private readonly options: ProviderOptions) {
    this.spawnProcess = options.spawnProcess ?? spawnNativeHelper;
  }

  async start(
    config: TranscriptionConfig,
    onEvent: (event: TranscriptionEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    if (this.active) throw new AppleNativeTranscriptionError('invalid-command');
    if (signal.aborted) throw new AppleNativeTranscriptionError('aborted');

    const startCommand: NativeCommand = {
      version: 1,
      type: 'start',
      ...config,
    };
    const startFrame = Buffer.from(encodeNativeCommand(startCommand));
    let executable: string;
    try {
      executable = await this.options.resolveExecutable();
    } catch {
      throw new AppleNativeTranscriptionError('helper-unavailable');
    }
    if (signal.aborted) throw new AppleNativeTranscriptionError('aborted');

    let closeResolver: ((result: ExitResult) => void) | undefined;
    const close = new Promise<ExitResult>((resolve) => {
      closeResolver = resolve;
    });
    const child = this.spawnProcess(executable, {
      cwd: dirname(executable),
      env: minimalEnvironment(),
      shell: false,
      detached: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const active: ActiveProcess = {
      child,
      decoder: new NativeJsonlDecoder(config),
      config,
      onEvent,
      states: new Map(config.sources.map((source) => [source, 'initial'])),
      waiters: new Set(),
      writeQueue: Promise.resolve(),
      close,
      resolveClose: (result) => closeResolver?.(result),
      stderrBytes: 0,
      closedCleanly: false,
    };
    this.active = active;
    this.attachProcessHandlers(active);

    const abort = (): void => {
      void this.stop().catch(() => undefined);
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      const listening = this.waitForStates(
        active,
        'listening',
        this.options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS,
      );
      await this.writeCommand(active, startFrame);
      await listening;
      if (signal.aborted) throw new AppleNativeTranscriptionError('aborted');
    } catch (error) {
      await this.stop().catch(() => undefined);
      if (signal.aborted) throw new AppleNativeTranscriptionError('aborted');
      throw this.toSafeError(error);
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }

  async pause(): Promise<void> {
    const active = this.requireActive('listening');
    const paused = this.waitForStates(
      active,
      'paused',
      this.options.commandTimeoutMs ?? COMMAND_TIMEOUT_MS,
    );
    await this.sendCommand(active, {
      version: 1,
      type: 'pause',
      sessionId: active.config.sessionId,
    });
    await paused;
  }

  async resume(): Promise<void> {
    const active = this.requireActive('paused');
    const listening = this.waitForStates(
      active,
      'listening',
      this.options.commandTimeoutMs ?? COMMAND_TIMEOUT_MS,
    );
    await this.sendCommand(active, {
      version: 1,
      type: 'resume',
      sessionId: active.config.sessionId,
    });
    await listening;
  }

  stop(): Promise<void> {
    const active = this.active;
    if (!active) return Promise.resolve();
    if (active.stopPromise) return active.stopPromise;
    active.stopPromise = this.stopActive(active).catch((error: unknown) => {
      active.stopPromise = undefined;
      throw error;
    });
    return active.stopPromise;
  }

  private async stopActive(active: ActiveProcess): Promise<void> {
    let stopFailure: Error | undefined;
    if (!active.closeResult) {
      try {
        await this.sendCommand(active, {
          version: 1,
          type: 'stop',
          sessionId: active.config.sessionId,
        });
      } catch (error) {
        stopFailure = this.toSafeError(error);
      }
    }

    if (!active.closeResult) {
      try {
        await this.withTimeout(
          active.close,
          this.options.stopTimeoutMs ?? STOP_TIMEOUT_MS,
          'timeout',
        );
      } catch {
        await this.terminate(active);
        stopFailure ??= new AppleNativeTranscriptionError('timeout');
      }
    }

    if (!active.closeResult) throw new AppleNativeTranscriptionError('timeout');

    if (this.active === active) this.active = undefined;
    this.rejectWaiters(active, stopFailure);
    if (stopFailure) throw stopFailure;
    if (active.failure) throw active.failure;
    if (!active.closedCleanly)
      throw new AppleNativeTranscriptionError('transport-failed');
  }

  private attachProcessHandlers(active: ActiveProcess): void {
    active.child.stdout.on('data', (chunk: Buffer) => {
      if (this.active !== active) return;
      try {
        for (const event of active.decoder.push(chunk))
          this.receiveEvent(active, event);
      } catch {
        this.fail(active, new AppleNativeTranscriptionError('protocol-failed'));
      }
    });
    active.child.stderr.on('data', (chunk: Buffer) => {
      active.stderrBytes += chunk.length;
      // Drain but never retain or forward native diagnostics that might contain speech.
      if (active.stderrBytes > MAX_STDERR_BYTES)
        this.fail(
          active,
          new AppleNativeTranscriptionError('transport-failed'),
        );
    });
    active.child.stdin.on('error', () => {
      this.fail(active, new AppleNativeTranscriptionError('transport-failed'));
    });
    active.child.once('error', () => {
      this.closeActive(active, { code: null, signal: null });
      this.fail(active, new AppleNativeTranscriptionError('transport-failed'));
    });
    active.child.once('close', (code, signal) => {
      this.closeActive(active, { code, signal });
    });
  }

  private receiveEvent(active: ActiveProcess, event: TranscriptionEvent): void {
    switch (event.type) {
      case 'ready':
        active.states.set(event.source, 'ready');
        break;
      case 'status':
        active.states.set(event.source, event.state);
        break;
      case 'error':
        active.states.set(event.source, 'error');
        active.failure ??= new AppleNativeTranscriptionError(event.code);
        break;
      case 'stopped':
        active.states.set(event.source, 'stopped');
        if (event.reason === 'error')
          active.failure ??= new AppleNativeTranscriptionError(
            'transport-failed',
          );
        break;
      case 'partial':
      case 'final':
        break;
    }

    try {
      active.onEvent(event);
    } catch {
      active.failure ??= new AppleNativeTranscriptionError('transport-failed');
      this.fail(active, active.failure);
      return;
    }
    this.checkWaiters(active);
  }

  private closeActive(active: ActiveProcess, result: ExitResult): void {
    if (active.closeResult) return;
    active.closeResult = result;
    if (result.code === 0) {
      try {
        active.decoder.finish();
        active.closedCleanly = true;
      } catch {
        active.failure ??= new AppleNativeTranscriptionError('protocol-failed');
      }
    } else {
      active.failure ??= new AppleNativeTranscriptionError('transport-failed');
    }
    active.resolveClose(result);
    this.checkWaiters(active);
  }

  private fail(
    active: ActiveProcess,
    failure: AppleNativeTranscriptionError,
  ): void {
    active.failure ??= failure;
    this.rejectWaiters(active, active.failure);
    if (!active.closeResult) active.child.kill('SIGTERM');
  }

  private requireActive(state: 'listening' | 'paused'): ActiveProcess {
    const active = this.active;
    if (
      !active ||
      [...active.states.values()].some((current) => current !== state)
    )
      throw new AppleNativeTranscriptionError('invalid-command');
    return active;
  }

  private async sendCommand(
    active: ActiveProcess,
    command: NativeCommand,
  ): Promise<void> {
    await this.writeCommand(active, Buffer.from(encodeNativeCommand(command)));
  }

  private writeCommand(active: ActiveProcess, frame: Buffer): Promise<void> {
    const write = active.writeQueue.then(() =>
      this.writeFrame(active.child, frame),
    );
    active.writeQueue = write;
    return write;
  }

  private writeFrame(
    child: ChildProcessWithoutNullStreams,
    frame: Buffer,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new AppleNativeTranscriptionError('timeout'));
      }, this.options.commandTimeoutMs ?? COMMAND_TIMEOUT_MS);
      const onError = (): void => {
        cleanup();
        reject(new AppleNativeTranscriptionError('transport-failed'));
      };
      const onDrain = (): void => {
        cleanup();
        resolve();
      };
      const cleanup = (): void => {
        clearTimeout(timer);
        child.stdin.off('error', onError);
        child.stdin.off('drain', onDrain);
      };
      child.stdin.once('error', onError);
      const accepted = child.stdin.write(frame);
      if (accepted) {
        cleanup();
        resolve();
      } else {
        child.stdin.once('drain', onDrain);
      }
    });
  }

  private waitForStates(
    active: ActiveProcess,
    expected: 'listening' | 'paused',
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiter: StateWaiter = {
        check: () => {
          if (active.failure) waiter.finish(active.failure);
          else if (
            active.states.size > 0 &&
            [...active.states.values()].every((state) => state === expected)
          )
            waiter.finish();
          else if (active.closeResult)
            waiter.finish(
              new AppleNativeTranscriptionError('transport-failed'),
            );
        },
        finish: (error) => {
          clearTimeout(timer);
          active.waiters.delete(waiter);
          if (error) reject(error);
          else resolve();
        },
      };
      const timer = setTimeout(
        () => waiter.finish(new AppleNativeTranscriptionError('timeout')),
        timeoutMs,
      );
      active.waiters.add(waiter);
      waiter.check();
    });
  }

  private checkWaiters(active: ActiveProcess): void {
    for (const waiter of [...active.waiters]) waiter.check();
  }

  private rejectWaiters(active: ActiveProcess, error?: Error): void {
    if (!error) return;
    for (const waiter of [...active.waiters]) waiter.finish(error);
  }

  private async terminate(active: ActiveProcess): Promise<void> {
    if (active.closeResult) return;
    active.child.kill('SIGTERM');
    try {
      await this.withTimeout(
        active.close,
        this.options.terminateTimeoutMs ?? TERMINATE_TIMEOUT_MS,
        'timeout',
      );
      return;
    } catch {
      if (!active.closeResult) active.child.kill('SIGKILL');
    }
    try {
      await this.withTimeout(active.close, TERMINATE_TIMEOUT_MS, 'timeout');
    } catch {
      // Keep ownership until the child's real close event arrives; a kill request
      // alone does not prove the process has exited.
    }
  }

  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    code: SafeFailureCode,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AppleNativeTranscriptionError(code));
      }, timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(this.toSafeError(error));
        },
      );
    });
  }

  private toSafeError(error: unknown): AppleNativeTranscriptionError {
    if (error instanceof AppleNativeTranscriptionError) return error;
    if (error instanceof NativeProtocolError)
      return new AppleNativeTranscriptionError('protocol-failed');
    return new AppleNativeTranscriptionError('transport-failed');
  }
}

function spawnNativeHelper(
  executable: string,
  options: SpawnOptions,
): ChildProcessWithoutNullStreams {
  return spawn(executable, [], options) as ChildProcessWithoutNullStreams;
}

function minimalEnvironment(): NodeJS.ProcessEnv {
  return {
    HOME: homedir(),
    LANG: process.env['LANG'] ?? 'en_US.UTF-8',
    PATH: '/usr/bin:/bin',
    TMPDIR: process.env['TMPDIR'] ?? '/tmp',
  };
}
