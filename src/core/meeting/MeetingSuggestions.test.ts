import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingSuggestions } from './MeetingSuggestions';
import { MeetingSession } from './MeetingSession';
import type {
  SuggestionRequest,
  SuggestionResult,
} from '../suggestions/SuggestionProvider';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';

const config = {
  sessionId: 'synthetic-session',
  sources: ['mic'] as ['mic'],
  locale: 'pt-BR' as const,
};
const authorization = { model: 'synthetic-model', maxRequests: 2 };
const card = {
  category: 'question' as const,
  title: 'Prazo sintético',
  body: 'Confirme o prazo do projeto fictício.',
  groundedIn: 'inference' as const,
};
function speech(
  seq = 1,
  text = 'Qual é o prazo do projeto fictício?',
): SpeechSegment {
  return {
    sessionId: config.sessionId,
    locale: config.locale,
    source: 'mic',
    version: 1,
    type: 'final',
    seq,
    timestampMs: seq * 1000,
    startMs: seq * 1000 - 100,
    endMs: seq * 1000,
    segmentId: `s${seq}`,
    text,
  };
}
function setup(consent = true, maxRequests = 2) {
  const session = new MeetingSession();
  const generate = vi
    .fn<(request: SuggestionRequest) => Promise<SuggestionResult>>()
    .mockResolvedValue({ ok: true, suggestions: [card] });
  const create = vi.fn(() => ({ generate }));
  const pipeline = new MeetingSuggestions(session, create);
  const start = () => {
    session.start({
      mode: 'apple-local',
      ...config,
      consent: { capture: true, context: consent, remoteAudio: false },
    });
    pipeline.start(config, { ...authorization, maxRequests });
  };
  start();
  return { pipeline, session, generate, create, start };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('session suggestion integration with synthetic speech', () => {
  it('distinguishes final/trigger/debounce/preparation/transport and clears payload on pause', async () => {
    const { pipeline, generate, session } = setup();
    expect(pipeline.snapshot().diagnostics?.activity).toBe('waiting-final');
    pipeline.receive({ ...speech(), type: 'partial' });
    expect(pipeline.snapshot().diagnostics?.activity).toBe('waiting-final');
    pipeline.receive(speech(2, 'Obrigado.'));
    expect(pipeline.snapshot().diagnostics?.activity).toBe('waiting-trigger');
    let finish: (result: SuggestionResult) => void = () => {};
    generate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    pipeline.receive(speech(3));
    expect(pipeline.snapshot().diagnostics).toMatchObject({
      activity: 'debounce',
      lastTrigger: 'question',
      lastAttempt: null,
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(pipeline.snapshot().diagnostics).toMatchObject({
      activity: 'preparing',
      lastAttempt: { number: 1, result: 'pending', requestBody: null },
    });
    const input = generate.mock.calls[0]?.[0];
    input?.onDispatch?.('{"input":"synthetic"}');
    expect(pipeline.snapshot().diagnostics?.activity).toBe('requesting');
    input?.onHttpResponse?.(200);
    await vi.advanceTimersByTimeAsync(100);
    finish({ ok: true, suggestions: [] });
    await vi.advanceTimersByTimeAsync(0);
    expect(pipeline.snapshot().diagnostics?.lastAttempt).toMatchObject({
      result: 'empty',
      httpStatus: 200,
      suggestionCount: 0,
      durationMs: 100,
      requestBody: '{"input":"synthetic"}',
    });
    session.pause();
    pipeline.pause();
    expect(pipeline.snapshot().diagnostics).toMatchObject({
      activity: 'paused',
      lastAttempt: { requestBody: null },
    });
    session.resume();
    pipeline.resume();
    expect(
      pipeline.snapshot().diagnostics?.lastAttempt?.requestBody,
    ).toBeNull();
    pipeline.stop();
    expect(pipeline.snapshot().diagnostics).toBeNull();
  });

  it('records safe HTTP failures, replaces only the latest attempt, and reports cooldown', async () => {
    const { pipeline, generate } = setup();
    generate.mockImplementation((input) => {
      input.onDispatch?.('{"input":"synthetic"}');
      input.onHttpResponse?.(401);
      return Promise.resolve({ ok: false, code: 'authentication' });
    });
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(500);
    expect(pipeline.snapshot().diagnostics?.lastAttempt).toMatchObject({
      number: 1,
      result: 'authentication',
      httpStatus: 401,
    });
    pipeline.receive(speech(2));
    await vi.advanceTimersByTimeAsync(500);
    expect(pipeline.snapshot().diagnostics?.activity).toBe('cooldown');
    await vi.advanceTimersByTimeAsync(9500);
    expect(pipeline.snapshot().diagnostics?.lastAttempt?.number).toBe(2);
    expect(pipeline.snapshot().remainingRequests).toBe(0);
  });

  it('marks invalidated attempts cancelled immediately and ignores late transport callbacks after restart', async () => {
    const { pipeline, generate, session, start } = setup();
    let finish: (result: SuggestionResult) => void = () => {};
    generate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(500);
    const input = generate.mock.calls[0]?.[0];
    input?.onDispatch?.('synthetic-old-body');
    pipeline.receive(speech(2, 'Obrigado.'));
    expect(pipeline.snapshot().diagnostics?.lastAttempt?.result).toBe(
      'cancelled',
    );
    session.stop();
    pipeline.stop();
    start();
    input?.onDispatch?.('late-private-body');
    input?.onHttpResponse?.(200);
    finish({ ok: true, suggestions: [card] });
    await vi.advanceTimersByTimeAsync(0);
    expect(pipeline.snapshot().diagnostics?.lastAttempt).toBeNull();
    expect(pipeline.snapshot().items).toEqual([]);
  });
  it('requires text consent before constructing a provider or retaining context', async () => {
    const { pipeline, create, generate } = setup(false);
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(10000);
    expect(create).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(pipeline.snapshot()).toEqual({
      items: [],
      remainingRequests: 0,
      status: 'disabled',
      diagnostics: null,
    });
  });

  it('debounces finals, excludes partials and publishes dismissible expiring cards', async () => {
    const { pipeline, generate } = setup();
    pipeline.receive({ ...speech(), type: 'partial' });
    await vi.advanceTimersByTimeAsync(500);
    expect(generate).not.toHaveBeenCalled();
    pipeline.receive({ ...speech(), seq: 2 });
    await vi.advanceTimersByTimeAsync(499);
    expect(generate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0]?.[0].context.recent).toEqual([
      expect.objectContaining({
        type: 'final',
        text: 'Qual é o prazo do projeto fictício?',
      }),
    ]);
    expect(pipeline.snapshot()).toMatchObject({
      items: [card],
      remainingRequests: 1,
    });
    const id = pipeline.snapshot().items[0]?.id ?? '';
    pipeline.dismiss(id);
    expect(pipeline.snapshot().items).toEqual([]);
    pipeline.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the last authorized response visible and enforces the attempt budget across pause', async () => {
    const { pipeline, session, generate } = setup(true, 1);
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(500);
    expect(pipeline.snapshot()).toMatchObject({
      status: 'exhausted',
      remainingRequests: 0,
      items: [card],
    });
    session.pause();
    pipeline.pause();
    session.resume();
    pipeline.resume();
    pipeline.receive(speech(2));
    await vi.advanceTimersByTimeAsync(20000);
    expect(generate).toHaveBeenCalledOnce();
    expect(pipeline.snapshot().items).toEqual([]);
  });

  it.each(['pause', 'stop', 'revoke', 'new-final'] as const)(
    'aborts and discards late responses after %s',
    async (action) => {
      const { pipeline, session, generate } = setup();
      let resolve: (result: SuggestionResult) => void = () => {};
      generate.mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      pipeline.receive(speech());
      await vi.advanceTimersByTimeAsync(500);
      const signal = generate.mock.calls[0]?.[0].signal;
      if (action === 'pause') {
        session.pause();
        pipeline.pause();
      }
      if (action === 'stop') {
        session.stop();
        pipeline.stop();
      }
      if (action === 'revoke') {
        session.revokeContext();
        pipeline.stop();
      }
      if (action === 'new-final') pipeline.receive(speech(2, 'Obrigado.'));
      expect(signal?.aborted).toBe(true);
      resolve({ ok: true, suggestions: [card] });
      await vi.advanceTimersByTimeAsync(10000);
      expect(pipeline.snapshot().items).toEqual([]);
      expect(generate).toHaveBeenCalledOnce();
    },
  );

  it('serializes a non-cooperative provider across restart and clears old context', async () => {
    const { pipeline, session, generate, start } = setup();
    let resolve: (result: SuggestionResult) => void = () => {};
    generate.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(500);
    session.stop();
    pipeline.stop();
    start();
    pipeline.receive(speech(2, 'Como podemos validar o protótipo fictício?'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(generate).toHaveBeenCalledOnce();
    resolve({ ok: true, suggestions: [card] });
    await vi.advanceTimersByTimeAsync(0);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].context.recent).toHaveLength(1);
    expect(generate.mock.calls[1]?.[0].context.recent[0]?.text).toContain(
      'protótipo',
    );
  });

  it('invalidates changed content but ignores a duplicate final and foreign session', async () => {
    const { pipeline, generate } = setup();
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(500);
    pipeline.receive({ ...speech(), seq: 2 });
    pipeline.receive({ ...speech(3), sessionId: 'foreign' });
    expect(pipeline.snapshot().items).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(generate).toHaveBeenCalledOnce();
    pipeline.receive(speech(3, 'Obrigado.'));
    expect(pipeline.snapshot().items).toEqual([]);
    await vi.advanceTimersByTimeAsync(10000);
    expect(generate).toHaveBeenCalledOnce();
  });

  it('advances context during silence, archives old speech, and expires cards without new speech', async () => {
    const { pipeline, generate } = setup();
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(30500);
    expect(pipeline.snapshot().items).toEqual([]);
    await vi.advanceTimersByTimeAsync(240000);
    pipeline.receive({
      ...speech(2),
      timestampMs: 280000,
      startMs: 279000,
      endMs: 280000,
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(generate.mock.calls[1]?.[0].context.recent).toHaveLength(1);
    expect(generate.mock.calls[1]?.[0].context.summary).toHaveLength(1);
  });

  it('counts safe failures as attempts without exposing provider details', async () => {
    const { pipeline, generate } = setup(true, 1);
    generate.mockResolvedValue({ ok: false, code: 'credentials-unavailable' });
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(500);
    expect(pipeline.snapshot()).toMatchObject({
      items: [],
      remainingRequests: 0,
      status: 'unavailable',
      diagnostics: {
        lastAttempt: {
          result: 'credentials-unavailable',
          requestBody: null,
          httpStatus: null,
        },
      },
    });
  });
});
