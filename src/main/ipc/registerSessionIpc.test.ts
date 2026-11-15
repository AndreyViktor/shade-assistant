import { OpenAISuggestionProvider } from '../../infrastructure/ai/OpenAISuggestionProvider';
import type { SuggestionProviderFactory } from '../../core/meeting/MeetingSuggestions';
import { cleanupSessions } from '../app/sessionCleanup';
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
  version: 8,
  action: 'start',
  options: {
    mode: 'demo',
    consent: { capture: false, context: false, remoteAudio: false },
  },
} satisfies SessionRequest;
const appleStart = {
  version: 8,
  action: 'start',
  options: {
    mode: 'apple-local',
    consent: { capture: true, context: false, remoteAudio: false },
    locale: 'pt-BR',
    sources: ['mic', 'system'],
  },
} satisfies SessionRequest;

function setup(
  platform: NodeJS.Platform = 'darwin',
  createSuggestionProvider?: SuggestionProviderFactory,
) {
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
    createSuggestionProvider,
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
  return parseSessionResult(await call({ version: 8, action: 'read' }));
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
    await call({ version: 8, action: 'pause' });
    const paused = await read(call);
    vi.advanceTimersByTime(10000);
    expect(await read(call)).toEqual(paused);
    await call({ version: 8, action: 'resume' });
    await call({ version: 8, action: 'stop' });
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
    await call({ version: 8, action: 'pause' });
    expect(pauseMock.mock.calls).toHaveLength(1);
    expect(await read(call)).toMatchObject({
      ok: true,
      session: { phase: 'paused', mode: 'apple-local' },
    });
    await call({ version: 8, action: 'resume' });
    expect(resumeMock.mock.calls).toHaveLength(1);
    await call({ version: 8, action: 'stop' });
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
        version: 8,
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
    await call({ version: 8, action: 'pause' });
    emit({ ...speech, seq: 2, segmentId: 'paused' });
    const paused = await read(call);
    expect(paused.ok && paused.local?.segments).toHaveLength(2);
    await call({ version: 8, action: 'resume' });
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
    await call({ version: 8, action: 'stop' });
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
  await call({ version: 8, action: 'stop' });
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

const withSuggestions = {
  ...appleStart,
  options: {
    ...appleStart.options,
    consent: { capture: true, context: true, remoteAudio: false },
    suggestions: {
      model: 'synthetic-model',
      maxRequests: 1,
      userContext: 'T053 contexto sintético: esclarecer riscos como designer.',
    },
  },
};
function emitQuestion() {
  const start = startMock.mock.calls.at(-1);
  if (!start) throw new Error('Missing synthetic provider');
  start[1]({
    version: 1,
    sessionId: start[0].sessionId,
    source: 'mic',
    locale: 'pt-BR',
    seq: 1,
    timestampMs: 1000,
    type: 'final',
    segmentId: 'synthetic-question',
    startMs: 0,
    endMs: 1000,
    text: 'Qual é o prazo do projeto fictício Aurora?',
  });
}

it('connects native events to real Responses serialization with synthetic credentials/transport only', async () => {
  const getApiKey = vi.fn(() => Promise.resolve('synthetic-key'));
  const transport = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  suggestions: [
                    {
                      category: 'question',
                      title: 'Prazo',
                      body: 'Confirme o prazo fictício.',
                      groundedIn: 'inference',
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    ),
  );
  const { call } = setup(
    'darwin',
    (authorization, isAuthorized) =>
      new OpenAISuggestionProvider({
        model: authorization.model,
        isAuthorized,
        getApiKey,
        fetch: transport,
      }),
  );
  await call(appleStart);
  emitQuestion();
  await vi.advanceTimersByTimeAsync(1000);
  expect(getApiKey).not.toHaveBeenCalled();
  await call({ version: 8, action: 'stop' });
  await call(withSuggestions);
  emitQuestion();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(transport).toHaveBeenCalledOnce();
  expect(transport.mock.calls[0]?.[0]).toBe(
    'https://api.openai.com/v1/responses',
  );
  const body = transport.mock.calls[0]?.[1]?.body;
  expect(typeof body).toBe('string');
  expect(body).toContain('Qual é o prazo do projeto fictício Aurora?');
  expect(body).not.toMatch(/sessionId|segmentId|input_audio|input_image/);
  expect(body).toContain(withSuggestions.options.suggestions.userContext);
  expect(await read(call)).toMatchObject({
    suggestions: { status: 'exhausted', items: [{ title: 'Prazo' }] },
  });
  await vi.advanceTimersByTimeAsync(60000);
  expect(await read(call)).toMatchObject({
    suggestions: {
      status: 'exhausted',
      items: [{ title: 'Prazo', expiresAt: null }],
    },
  });
  expect(transport).toHaveBeenCalledOnce();
  expect(JSON.stringify(await read(call))).not.toContain('synthetic-key');
  await call({ version: 8, action: 'revoke-suggestions' });
  expect(await read(call)).toMatchObject({
    session: { phase: 'running', consent: { context: false, capture: true } },
    suggestions: { status: 'disabled', items: [] },
  });
  expect(stopMock).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(await read(call))).not.toContain(
    withSuggestions.options.suggestions.userContext,
  );
});

it.each(['pause', 'stop', 'revoke-suggestions', 'reload', 'failure'] as const)(
  'cancels suggestions on %s while a credential mock is pending',
  async (action) => {
    let resolve: (key: string) => void = () => {};
    const getApiKey = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const transport = vi.fn<typeof fetch>();
    const { call, window } = setup(
      'darwin',
      (authorization, isAuthorized) =>
        new OpenAISuggestionProvider({
          model: authorization.model,
          isAuthorized,
          getApiKey,
          fetch: transport,
        }),
    );
    await call(withSuggestions);
    emitQuestion();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(getApiKey).toHaveBeenCalledOnce();
    if (action === 'reload')
      window.webContents.on.mock.calls.find(
        ([name]) => name === 'did-start-loading',
      )?.[1]();
    else if (action === 'failure') startMock.mock.calls.at(-1)?.[3]?.();
    else await call({ version: 8, action });
    resolve('synthetic-key');
    await vi.advanceTimersByTimeAsync(0);
    expect(transport).not.toHaveBeenCalled();
    expect(await read(call)).toMatchObject({ suggestions: { items: [] } });
  },
);

it('blocks restart while native cleanup from reload is pending', async () => {
  let finish: () => void = () => {};
  stopMock.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { call, window } = setup();
  await call(appleStart);
  window.webContents.on.mock.calls.find(
    ([name]) => name === 'did-start-loading',
  )?.[1]();
  expect(await call(appleStart)).toMatchObject({
    ok: false,
    code: 'INVALID_REQUEST',
  });
  expect(startMock).toHaveBeenCalledOnce();
  finish();
  await vi.advanceTimersByTimeAsync(0);
  expect(await call(appleStart)).toMatchObject({ ok: true });
});

it('does not start capture if stop arrives during the mocked OS permission prompt', async () => {
  let finish: (allowed: boolean) => void = () => {};
  requestMicrophoneAccess.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { call } = setup();
  const starting = call(appleStart);
  await call({ version: 8, action: 'stop' });
  finish(true);
  expect(await starting).toMatchObject({ ok: false });
  expect(createAppleProvider).not.toHaveBeenCalled();
});

it('shutdown waits for late provider creation and its stop before completing', async () => {
  let finishCreation: (value: TranscriptionProvider) => void = () => {};
  let finishStop: () => void = () => {};
  const lateProvider = {
    ...provider,
    stop: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishStop = resolve;
        }),
    ),
  };
  createAppleProvider.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCreation = resolve;
      }),
  );
  const { call } = setup();
  const starting = call(appleStart);
  await vi.waitFor(() => expect(createAppleProvider).toHaveBeenCalledOnce());
  let completed = false;
  const shutdown = cleanupSessions().then(() => {
    completed = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(completed).toBe(false);
  finishCreation(lateProvider);
  await vi.advanceTimersByTimeAsync(0);
  expect(lateProvider.stop).toHaveBeenCalledOnce();
  expect(completed).toBe(false);
  finishStop();
  await starting;
  await shutdown;
  expect(completed).toBe(true);
  expect(startMock).not.toHaveBeenCalled();
});
