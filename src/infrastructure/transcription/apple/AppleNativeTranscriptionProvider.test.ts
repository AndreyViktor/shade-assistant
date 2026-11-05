import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptions,
} from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  AppleNativeTranscriptionError,
  AppleNativeTranscriptionProvider,
} from './AppleNativeTranscriptionProvider';
import { parseNativeCommand } from '../../../contracts/native/protocol';
import type {
  AudioSource,
  NativeCommand,
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../../contracts/native/protocol';

const config: TranscriptionConfig = {
  sessionId: 'provider-test',
  sources: ['mic', 'system'],
  locale: 'pt-BR',
};

type FakeProcess = ChildProcessWithoutNullStreams & {
  commands: NativeCommand[];
  deliver: (event: TranscriptionEvent) => void;
  writeStdout: (data: string) => void;
  finish: (code: number, signal?: NodeJS.Signals | null) => void;
};

function fakeProcess(
  onCommand: (command: NativeCommand, process: FakeProcess) => void,
): FakeProcess {
  const process = new EventEmitter() as FakeProcess;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  const commands: NativeCommand[] = [];
  stdin.on('data', (chunk: Buffer) => {
    const command = parseNativeCommand(JSON.parse(chunk.toString('utf8')));
    commands.push(command);
    onCommand(command, process);
  });
  Object.assign(process, {
    stdin,
    stdout,
    stderr,
    stdio: [stdin, stdout, stderr],
    pid: 3001,
    killed: false,
    exitCode: null,
    signalCode: null,
    commands,
    deliver(event: TranscriptionEvent) {
      const frame = Buffer.from(`${JSON.stringify(event)}\n`);
      if (stdout.writableEnded) stdout.emit('data', frame);
      else stdout.write(frame);
    },
    writeStdout(data: string) {
      stdout.write(data);
    },
    finish(code: number, signal: NodeJS.Signals | null = null) {
      Object.assign(process, { exitCode: code, signalCode: signal });
      stdout.end();
      stderr.end();
      process.emit('close', code, signal);
    },
    kill(signal?: NodeJS.Signals | number) {
      Object.assign(process, { killed: true });
      process.finish(1, typeof signal === 'string' ? signal : 'SIGTERM');
      return true;
    },
  });
  return process;
}

function validEvents(
  sessionId: string,
  source: AudioSource,
): TranscriptionEvent[] {
  return [
    {
      version: 1,
      sessionId,
      source,
      locale: 'pt-BR',
      seq: 1,
      timestampMs: 1,
      type: 'ready',
      supportsPartial: true,
    },
    {
      version: 1,
      sessionId,
      source,
      locale: 'pt-BR',
      seq: 2,
      timestampMs: 2,
      type: 'status',
      state: 'listening',
    },
  ];
}

function successfulProcess(): FakeProcess {
  const sequences = new Map<AudioSource, number>([
    ['mic', 0],
    ['system', 0],
  ]);
  function deliverNext(process: FakeProcess, event: TranscriptionEvent): void {
    const seq = (sequences.get(event.source) ?? 0) + 1;
    sequences.set(event.source, seq);
    process.deliver({ ...event, seq });
  }
  return fakeProcess((command, process) => {
    for (const source of config.sources) {
      if (command.type === 'start') {
        for (const event of validEvents(command.sessionId, source)) {
          deliverNext(process, event);
        }
      }
      if (command.type === 'pause')
        deliverNext(process, {
          version: 1,
          sessionId: command.sessionId,
          source,
          locale: config.locale,
          seq: 0,
          timestampMs: 3,
          type: 'status',
          state: 'paused',
        });
      if (command.type === 'resume')
        deliverNext(process, {
          version: 1,
          sessionId: command.sessionId,
          source,
          locale: config.locale,
          seq: 0,
          timestampMs: 4,
          type: 'status',
          state: 'listening',
        });
      if (command.type === 'stop')
        deliverNext(process, {
          version: 1,
          sessionId: command.sessionId,
          source,
          locale: config.locale,
          seq: 0,
          timestampMs: 5,
          type: 'stopped',
          reason: 'completed',
        });
    }
    if (command.type === 'stop') process.finish(0);
  });
}

function providerFor(
  process: FakeProcess,
  observeOptions?: (executable: string, options: SpawnOptions) => void,
): AppleNativeTranscriptionProvider {
  return new AppleNativeTranscriptionProvider({
    resolveExecutable: () =>
      Promise.resolve('/trusted/native/MeetingCopilotTranscriber'),
    spawnProcess: (executable, options) => {
      observeOptions?.(executable, options);
      return process;
    },
    startupTimeoutMs: 100,
    commandTimeoutMs: 100,
    stopTimeoutMs: 100,
    terminateTimeoutMs: 20,
  });
}

describe('AppleNativeTranscriptionProvider', () => {
  it('spawns without a shell or inherited secrets and waits for every source', async () => {
    const process = successfulProcess();
    let observedOptions: SpawnOptions | undefined;
    const received: TranscriptionEvent[] = [];
    const provider = providerFor(process, (executable, options) => {
      expect(executable).toBe('/trusted/native/MeetingCopilotTranscriber');
      observedOptions = options;
    });

    await provider.start(
      config,
      (event) => received.push(event),
      new AbortController().signal,
    );
    expect(observedOptions?.shell).toBe(false);
    expect(observedOptions?.detached).toBe(false);
    expect(observedOptions?.stdio).toEqual(['pipe', 'pipe', 'pipe']);
    expect(observedOptions?.env).not.toHaveProperty('OPENAI_API_KEY');
    expect(received.filter((event) => event.type === 'status')).toHaveLength(2);
    await provider.stop();
    expect(process.commands.map((command) => command.type)).toEqual([
      'start',
      'stop',
    ]);
    expect(process.killed).toBe(false);
  });

  it('serializes pause, resume and stop and rejects further callbacks after stop', async () => {
    const process = successfulProcess();
    const received: TranscriptionEvent[] = [];
    const provider = providerFor(process);
    await provider.start(
      config,
      (event) => received.push(event),
      new AbortController().signal,
    );
    await provider.pause();
    await provider.resume();
    await provider.stop();
    const eventCountAfterStop = received.length;
    const firstEvent = received[0];
    if (!firstEvent) throw new Error('Expected a native ready event');
    process.deliver(firstEvent);
    expect(received).toHaveLength(eventCountAfterStop);
    expect(process.commands.map((command) => command.type)).toEqual([
      'start',
      'pause',
      'resume',
      'stop',
    ]);
  });

  it('fails closed and kills the helper when stdout violates the protocol', async () => {
    const process = fakeProcess((command, process) => {
      if (command.type === 'start') process.writeStdout('not-json\n');
    });
    const provider = providerFor(process);
    await expect(
      provider.start(config, () => undefined, new AbortController().signal),
    ).rejects.toMatchObject({
      name: 'AppleNativeTranscriptionError',
      code: 'protocol-failed',
    });
    expect(process.killed).toBe(true);
  });

  it('aborts during startup and waits for helper cleanup', async () => {
    const process = fakeProcess((command, process) => {
      if (command.type === 'stop') {
        for (const source of config.sources)
          process.deliver({
            version: 1,
            sessionId: command.sessionId,
            source,
            locale: config.locale,
            seq: 1,
            timestampMs: 1,
            type: 'stopped',
            reason: 'cancelled',
          });
        process.finish(0);
      }
    });
    const provider = providerFor(process);
    const controller = new AbortController();
    const starting = provider.start(config, () => undefined, controller.signal);
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();
    await expect(starting).rejects.toMatchObject({ code: 'aborted' });
    expect(process.commands.map((command) => command.type)).toEqual([
      'start',
      'stop',
    ]);
    expect(process.killed).toBe(false);
  });

  it('maps resolver and unexpected process failures to safe codes', async () => {
    const missing = new AppleNativeTranscriptionProvider({
      resolveExecutable: () => Promise.reject(new Error('secret native path')),
    });
    await expect(
      missing.start(config, () => undefined, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'helper-unavailable' });

    const process = fakeProcess((_command, process) => {
      process.finish(9);
    });
    const provider = providerFor(process);
    await expect(
      provider.start(config, () => undefined, new AbortController().signal),
    ).rejects.toBeInstanceOf(AppleNativeTranscriptionError);
  });
});
