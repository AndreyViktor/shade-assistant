import { LocalTranscript } from '../../core/transcription/LocalTranscript';
import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import {
  SESSION_CHANNEL,
  parseSessionRequest,
} from '../../contracts/ipc/session';
import type { SessionResult } from '../../contracts/ipc/session';
import type { IpcErrorCode } from '../../contracts/ipc/appStatus';
import { DemoPlayback } from '../../infrastructure/transcription/mock/DemoPlayback';
import { AppleNativeTranscriptionError } from '../../infrastructure/transcription/apple/AppleNativeTranscriptionProvider';
import type { TranscriptionProvider } from '../../core/transcription/TranscriptionProvider';
import { MeetingSession } from '../../core/meeting/MeetingSession';
import { isAuthorizedRenderer } from './isAuthorizedRenderer';

type SessionIpcDependencies = {
  platform: NodeJS.Platform;
  requestMicrophoneAccess: () => Promise<boolean>;
  createAppleProvider: () => Promise<TranscriptionProvider>;
};

export function registerSessionIpc(
  window: BrowserWindow,
  rendererUrl: string,
  dependencies: SessionIpcDependencies,
): void {
  const session = new MeetingSession();
  const demo = new DemoPlayback(session);
  const local = new LocalTranscript();
  let activeSessionId: string | undefined;
  let provider: TranscriptionProvider | undefined;
  let startingCapture = false;
  let lifecycle = 0;

  const success = (): SessionResult => ({
    version: 3,
    ok: true,
    session: session.snapshot(),
    demo: demo.snapshot(),
    local: local.snapshot(),
  });
  const failure = (code: IpcErrorCode): SessionResult => ({
    version: 3,
    ok: false,
    code,
  });

  async function stopProvider(): Promise<void> {
    const active = provider;
    provider = undefined;
    if (active) await active.stop();
  }

  async function stopSession(): Promise<void> {
    lifecycle += 1;
    activeSessionId = undefined;
    local.clear();
    session.stop();
    demo.stop();
    await stopProvider();
  }

  function receiveNativeEvent(
    event: Parameters<Parameters<TranscriptionProvider['start']>[1]>[0],
  ): void {
    if (event.sessionId !== activeSessionId) return;
    if (!local.receive(event, session.permits('capture'))) return;
    const failed =
      event.type === 'error' ||
      (event.type === 'stopped' && event.reason === 'error');
    const snapshot = local.snapshot();
    const ended =
      snapshot &&
      snapshot.channels.length === snapshot.config.sources.length &&
      snapshot.channels.every((channel) => channel.type === 'stopped');
    if (!failed && !ended) return;
    // Preserve the startup failure code returned by provider.start().
    if (startingCapture) return;
    activeSessionId = undefined;
    if (failed) local.fail();
    else local.discardSpeech();
    session.stop();
    demo.stop();
    void stopProvider().catch(() => undefined);
  }

  ipcMain.handle(
    SESSION_CHANNEL,
    async (event, ...args: unknown[]): Promise<SessionResult> => {
      if (!isAuthorizedRenderer(window, rendererUrl, event))
        return failure('FORBIDDEN');
      const request = args.length === 1 ? parseSessionRequest(args[0]) : null;
      if (!request) return failure('INVALID_REQUEST');

      if (request.action === 'start') {
        const options = request.options;
        if (options.mode === 'openai-stt')
          return failure('REMOTE_STT_DEFERRED');
        if (options.mode === 'apple-local') {
          if (!options.consent.capture)
            return failure('CAPTURE_CONSENT_REQUIRED');
          if (options.consent.remoteAudio) return failure('INVALID_REQUEST');
          if (dependencies.platform !== 'darwin')
            return failure('TRANSCRIPTION_UNAVAILABLE');
          if (options.sources.includes('mic')) {
            try {
              if (!(await dependencies.requestMicrophoneAccess()))
                return failure('CAPTURE_PERMISSION_REQUIRED');
            } catch {
              return failure('CAPTURE_PERMISSION_REQUIRED');
            }
            if (!isAuthorizedRenderer(window, rendererUrl, event))
              return failure('FORBIDDEN');
          }
        }
        if (!session.start(options)) return failure('INVALID_REQUEST');
        local.clear();
        activeSessionId = undefined;

        if (options.mode === 'demo') {
          demo.start();
          return success();
        }

        const generation = ++lifecycle;
        try {
          const created = await dependencies.createAppleProvider();
          if (generation !== lifecycle) {
            await created.stop().catch(() => undefined);
            return failure('TRANSCRIPTION_START_FAILED');
          }
          provider = created;
        } catch {
          if (generation === lifecycle) session.stop();
          return failure('TRANSCRIPTION_UNAVAILABLE');
        }
        if (!isAuthorizedRenderer(window, rendererUrl, event)) {
          await stopSession().catch(() => undefined);
          return failure('FORBIDDEN');
        }

        const config = {
          sessionId: randomUUID().replaceAll('-', ''),
          sources: options.sources,
          locale: options.locale,
        };
        activeSessionId = config.sessionId;
        local.start(config);
        startingCapture = true;
        try {
          await session.run(
            'capture',
            (signal) =>
              provider?.start(config, receiveNativeEvent, signal, () => {
                if (activeSessionId !== config.sessionId) return;
                activeSessionId = undefined;
                local.fail();
                session.stop();
                void stopProvider().catch(() => undefined);
              }) ??
              Promise.reject(new AppleNativeTranscriptionError('aborted')),
          );
          if (
            generation !== lifecycle ||
            session.snapshot().phase !== 'running'
          )
            return failure('TRANSCRIPTION_START_FAILED');
          if (!isAuthorizedRenderer(window, rendererUrl, event)) {
            await stopSession().catch(() => undefined);
            return failure('FORBIDDEN');
          }
          return success();
        } catch (error) {
          if (generation !== lifecycle)
            return failure('TRANSCRIPTION_START_FAILED');
          activeSessionId = undefined;
          local.clear();
          session.stop();
          demo.stop();
          await stopProvider().catch(() => undefined);
          return failure(mapTranscriptionFailure(error));
        } finally {
          if (generation === lifecycle) startingCapture = false;
        }
      }

      if (request.action === 'pause') {
        if (session.snapshot().mode === 'apple-local') {
          try {
            if (!provider) return failure('TRANSCRIPTION_START_FAILED');
            await provider.pause();
          } catch {
            await stopSession().catch(() => undefined);
            return failure('TRANSCRIPTION_START_FAILED');
          }
        }
        const accepted = session.pause();
        if (!accepted) return failure('INVALID_REQUEST');
        if (session.snapshot().mode === 'demo') demo.pause();
      }

      if (request.action === 'resume') {
        if (session.snapshot().mode === 'apple-local') {
          try {
            if (!provider) return failure('TRANSCRIPTION_START_FAILED');
            await provider.resume();
          } catch {
            await stopSession().catch(() => undefined);
            return failure('TRANSCRIPTION_START_FAILED');
          }
        }
        const accepted = session.resume();
        if (!accepted) return failure('INVALID_REQUEST');
        if (session.snapshot().mode === 'demo') demo.resume();
      }

      if (request.action === 'stop') {
        try {
          await stopSession();
        } catch {
          return failure('TRANSCRIPTION_START_FAILED');
        }
      }
      if (request.action === 'dismiss-suggestion') demo.dismiss(request.id);

      if (!isAuthorizedRenderer(window, rendererUrl, event))
        return failure('FORBIDDEN');
      return success();
    },
  );

  // Reload/crash/close must not leave authorized capture behind.
  window.webContents.on('did-start-loading', () => {
    if (session.snapshot().phase !== 'idle')
      void stopSession().catch(() => undefined);
  });
  window.webContents.on('render-process-gone', () => {
    void stopSession().catch(() => undefined);
  });
  window.once('closed', () => {
    void stopSession().catch(() => undefined);
    ipcMain.removeHandler(SESSION_CHANNEL);
  });
}

function mapTranscriptionFailure(error: unknown): IpcErrorCode {
  if (!(error instanceof AppleNativeTranscriptionError))
    return 'TRANSCRIPTION_START_FAILED';
  switch (error.code) {
    case 'permission-denied':
      return 'CAPTURE_PERMISSION_REQUIRED';
    case 'assets-unavailable':
      return 'TRANSCRIPTION_ASSETS_UNAVAILABLE';
    case 'unsupported-locale':
      return 'TRANSCRIPTION_LOCALE_UNSUPPORTED';
    case 'unavailable':
    case 'helper-unavailable':
      return 'TRANSCRIPTION_UNAVAILABLE';
    default:
      return 'TRANSCRIPTION_START_FAILED';
  }
}
