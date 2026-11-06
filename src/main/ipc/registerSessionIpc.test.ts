// @vitest-environment node
import type { BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionRequest } from '../../contracts/ipc/session';
import {
  parseSessionResult,
  SESSION_CHANNEL,
} from '../../contracts/ipc/session';
import { emptyDemo } from '../../contracts/meeting/demo';
import { AppleNativeTranscriptionError } from '../../infrastructure/transcription/apple/AppleNativeTranscriptionProvider';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';
import type { TranscriptionProvider } from '../../core/transcription/TranscriptionProvider';
import { registerSessionIpc } from './registerSessionIpc';

const mocks = vi.hoisted(() => ({
  handle:
    vi.fn<
      (channel: string, listener: (...args: unknown[]) => unknown) => void
    >(),
  removeHandler: vi.fn(),
}));
vi.mock('electron', () => ({ ipcMain: mocks }));

const startMock = vi.fn<TranscriptionProvider['start']>(() =>
  Promise.resolve(),
);
const pauseMock = vi.fn<TranscriptionProvider['pause']>(() =>
  Promise.resolve(),
);
const resumeMock = vi.fn<TranscriptionProvider['resume']>(() =>
  Promise.resolve(),
);
const stopMock = vi.fn<TranscriptionProvider['stop']>(() => Promise.resolve());
const provider: TranscriptionProvider = {
  start: startMock,
  pause: pauseMock,
  resume: resumeMock,
  stop: stopMock,
};
const createAppleProvider = vi.fn(() => Promise.resolve(provider));
const requestMicrophoneAccess = vi.fn(() => Promise.resolve(true));
const demoStart = {
  version: 3,
  action: 'start',
  options: {
    mode: 'demo',
    consent: { capture: false, context: false, remoteAudio: false },
  },
} satisfies SessionRequest;
const appleStart = {
  version: 3,
  action: 'start',
  options: {
    mode: 'apple-local',
    consent: { capture: true, context: false, remoteAudio: false },
    locale: 'pt-BR',
    sources: ['mic', 'system'],
  },
} satisfies SessionRequest;

function setup(platform: NodeJS.Platform = 'darwin') {
  const frame = { url: 'file:///renderer.html' };
  const window = {
    isDestroyed: () => false,
    webContents: {
      mainFrame: frame,
      on: vi.fn<(event: string, callback: () => void) => void>(),
    },
    once: vi.fn<(event: string, callback: () => void) => void>(),
  };
  registerSessionIpc(window as unknown as BrowserWindow, frame.url, {
    platform,
    createAppleProvider,
    requestMicrophoneAccess,
  });
  const listener = mocks.handle.mock.calls.at(-1)?.[1];
  if (!listener) throw new Error('Missing handler');
  const event = { sender: window.webContents, senderFrame: frame };
  return {
    window,
    event,
    listener,
    call: (request: unknown) => listener(event, request),
  };
}

async function read(call: (request: unknown) => unknown) {
  return parseSessionResult(await call({ version: 3, action: 'read' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('session main boundary and provider selection', () => {
  it('keeps deterministic DEMO playback and cleanup available', async () => {
    const { call } = setup();
    await call(demoStart);
    vi.advanceTimersByTime(5000);
    expect(await read(call)).toMatchObject({
      ok: true,
      demo: { transcript: { sequence: 2, source: 'system' }, suggestions: [] },
    });
    await call({ version: 3, action: 'pause' });
    const paused = await read(call);
    vi.advanceTimersByTime(10000);
    expect(await read(call)).toEqual(paused);
    await call({ version: 3, action: 'resume' });
    await call({ version: 3, action: 'stop' });
    expect(await read(call)).toMatchObject({
      ok: true,
      session: { phase: 'stopped', mode: 'demo' },
      demo: emptyDemo(),
      local: null,
    });
    expect(createAppleProvider).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts the selected Apple provider only with capture consent and controls its lifecycle', async () => {
    const { call } = setup();
    expect(parseSessionResult(await call(appleStart))).toMatchObject({
      ok: true,
      session: { phase: 'running', mode: 'apple-local' },
    });
    expect(requestMicrophoneAccess).toHaveBeenCalledOnce();
    const startCall = startMock.mock.calls.at(0);
    expect(startMock.mock.calls).toHaveLength(1);
    expect(startCall?.[0]).toMatchObject({
      locale: 'pt-BR',
      sources: ['mic', 'system'],
    });
    expect(startCall?.[0].sessionId).toMatch(/^[a-f0-9]{32}$/);
    expect(startCall?.[1]).toEqual(expect.any(Function));
    expect(startCall?.[2]).toBeInstanceOf(AbortSignal);
    await call({ version: 3, action: 'pause' });
    expect(pauseMock.mock.calls).toHaveLength(1);
    expect(await read(call)).toMatchObject({
      ok: true,
      session: { phase: 'paused', mode: 'apple-local' },
    });
    await call({ version: 3, action: 'resume' });
    expect(resumeMock.mock.calls).toHaveLength(1);
    await call({ version: 3, action: 'stop' });
    expect(stopMock.mock.calls).toHaveLength(1);
    expect(await read(call)).toMatchObject({
      ok: true,
      session: {
        phase: 'stopped',
        mode: 'apple-local',
        consent: { capture: false, remoteAudio: false },
      },
    });
  });

  it('requests microphone access in the authorized main process before creating the helper', async () => {
    const { call } = setup();
    requestMicrophoneAccess.mockResolvedValueOnce(false);
    expect(await call(appleStart)).toMatchObject({
      ok: false,
      code: 'CAPTURE_PERMISSION_REQUIRED',
    });
    expect(createAppleProvider).not.toHaveBeenCalled();
    expect(startMock.mock.calls).toHaveLength(0);
  });

  it('rejects missing consent, non-Mac local capture and deferred remote STT before provider creation', async () => {
    const { call } = setup('linux');
    const noConsent = {
      ...appleStart,
      options: {
        ...appleStart.options,
        consent: { ...appleStart.options.consent, capture: false },
      },
    };
    expect(await call(noConsent)).toMatchObject({
      ok: false,
      code: 'CAPTURE_CONSENT_REQUIRED',
    });
    expect(await call(appleStart)).toMatchObject({
      ok: false,
      code: 'TRANSCRIPTION_UNAVAILABLE',
    });
    expect(
      await call({
        version: 3,
        action: 'start',
        options: {
          mode: 'openai-stt',
          consent: { capture: true, context: false, remoteAudio: true },
        },
      }),
    ).toMatchObject({ ok: false, code: 'REMOTE_STT_DEFERRED' });
    expect(createAppleProvider).not.toHaveBeenCalled();
  });

  it('maps native permission, asset and locale failures to safe UI codes and clears consent', async () => {
    const { call } = setup();
    startMock.mockRejectedValueOnce(
      new AppleNativeTranscriptionError('assets-unavailable'),
    );
    expect(await call(appleStart)).toMatchObject({
      ok: false,
      code: 'TRANSCRIPTION_ASSETS_UNAVAILABLE',
    });
    expect(await read(call)).toMatchObject({
      ok: true,
      session: {
        phase: 'stopped',
        mode: 'apple-local',
        consent: { capture: false, remoteAudio: false },
      },
    });
    expect(stopMock.mock.calls).toHaveLength(1);
  });

  it('preserves a native permission error emitted during startup', async () => {
    const { call } = setup();
    startMock.mockImplementationOnce((config, onEvent) => {
      onEvent({
        version: 1,
        sessionId: config.sessionId,
        source: 'mic',
        locale: config.locale,
        seq: 1,
        timestampMs: 0,
        type: 'error',
        code: 'permission-denied',
      });
      return Promise.reject(
        new AppleNativeTranscriptionError('permission-denied'),
      );
    });

    expect(await call(appleStart)).toMatchObject({
      ok: false,
      code: 'CAPTURE_PERMISSION_REQUIRED',
    });
    expect(await read(call)).toMatchObject({
      ok: true,
      session: {
        phase: 'stopped',
        mode: 'apple-local',
        consent: { capture: false },
      },
    });
    expect(stopMock.mock.calls).toHaveLength(1);
  });

  it('rejects unauthorized frames and stops a local helper on renderer close', async () => {
    const { call, event, listener, window } = setup();
    expect(await listener({ ...event, sender: {} }, appleStart)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    await call(appleStart);
    window.once.mock.calls[0]?.[1]();
    await vi.waitFor(() => expect(stopMock.mock.calls).toHaveLength(1));
    expect(mocks.removeHandler).toHaveBeenCalledWith(SESSION_CHANNEL);
    expect(await read(call)).toMatchObject({
      ok: true,
      session: { phase: 'stopped', consent: { capture: false } },
    });
  });
});

describe('local transcript delivery', () => {
  it('delivers time-ordered reconciled speech through the session IPC response', async () => {
    const { call } = setup();
    await call(appleStart);
    const start = startMock.mock.calls.at(-1);
    if (!start) throw new Error('Missing provider start');
    const [config, emit] = start;
    const final: SpeechSegment = {
      version: 1,
      sessionId: config.sessionId,
      source: 'system',
      locale: config.locale,
      seq: 1,
      timestampMs: 5000,
      type: 'final',
      segmentId: 'system-final',
      startMs: 1000,
      endMs: 2000,
      text: 'Precisamos revisar o plano de entrega.',
    };
    emit({
      ...final,
      source: 'mic',
      type: 'partial',
      segmentId: 'draft',
      startMs: 1100,
    });
    emit({ ...final, source: 'mic', seq: 2, segmentId: 'mic-final' });
    emit(final);
    emit({
      ...final,
      source: 'mic',
      seq: 3,
      type: 'partial',
      segmentId: 'pause-draft',
      startMs: 3000,
      endMs: 4000,
    });
    const result = await read(call);
    expect(
      result.ok && result.local?.segments.map((segment) => segment.segmentId),
    ).toEqual(['system-final', 'pause-draft']);
    emit({
      version: 1,
      sessionId: config.sessionId,
      source: 'mic',
      locale: config.locale,
      seq: 10,
      timestampMs: 11_000,
      type: 'status',
      state: 'paused',
    });
    const paused = await read(call);
    expect(
      paused.ok && paused.local?.segments.map((segment) => segment.segmentId),
    ).toEqual(['system-final']);
  });

  it('delivers both sources, ignores paused/late speech and retains only a safe native error on failure', async () => {
    const { call } = setup();
    await call(appleStart);
    const start = startMock.mock.calls.at(-1);
    if (!start) throw new Error('Missing provider start');
    const [config, emit] = start;
    const speech = {
      version: 1 as const,
      sessionId: config.sessionId,
      source: 'mic' as const,
      locale: config.locale,
      seq: 1,
      timestampMs: 100,
      type: 'final' as const,
      segmentId: 'segment',
      startMs: 0,
      endMs: 100,
      text: 'Conteúdo sintético',
    };
    emit(speech);
    emit({ ...speech, source: 'system' });
    expect(await read(call)).toMatchObject({
      local: { segments: [speech, { ...speech, source: 'system' }] },
    });
    await call({ version: 3, action: 'pause' });
    emit({ ...speech, seq: 2, segmentId: 'paused' });
    const paused = await read(call);
    expect(paused.ok && paused.local?.segments).toHaveLength(2);
    await call({ version: 3, action: 'resume' });
    emit({
      version: 1,
      sessionId: config.sessionId,
      source: 'mic',
      locale: config.locale,
      seq: 3,
      timestampMs: 200,
      type: 'error',
      code: 'capture-failed',
    });
    expect(await read(call)).toMatchObject({
      session: { phase: 'stopped' },
      local: {
        segments: [],
        channels: [{ type: 'error', code: 'capture-failed' }],
      },
    });
    emit({ ...speech, seq: 4 });
    expect(await read(call)).toMatchObject({ local: { segments: [] } });
    await call({ version: 3, action: 'stop' });
    expect(await read(call)).toMatchObject({ local: null });
    await call(appleStart);
    emit({ ...speech, seq: 5 });
    expect(await read(call)).toMatchObject({ local: { segments: [] } });
  });

  it('shows transport failure after start and clears content on reload', async () => {
    const { call, window } = setup();
    await call(appleStart);
    startMock.mock.calls.at(-1)?.[3]?.();
    expect(await read(call)).toMatchObject({
      session: { phase: 'stopped' },
      local: { failed: true, segments: [] },
    });
    window.webContents.on.mock.calls.find(
      ([name]) => name === 'did-start-loading',
    )?.[1]();
    expect(await read(call)).toMatchObject({ local: null });
  });
});

it('does not revive a stopped session when provider creation completes late', async () => {
  let resolveProvider: (value: TranscriptionProvider) => void = () => {};
  createAppleProvider.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveProvider = resolve;
      }),
  );
  const { call } = setup();
  const starting = call(appleStart);
  await vi.waitFor(() => expect(createAppleProvider).toHaveBeenCalledOnce());
  await call({ version: 3, action: 'stop' });
  resolveProvider(provider);
  expect(await starting).toMatchObject({
    ok: false,
    code: 'TRANSCRIPTION_START_FAILED',
  });
  expect(startMock).not.toHaveBeenCalled();
  expect(await read(call)).toMatchObject({
    session: { phase: 'stopped' },
    local: null,
  });
});
