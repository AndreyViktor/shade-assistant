import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingSuggestions } from './MeetingSuggestions';
import { MeetingSession } from './MeetingSession';
import type {
  SuggestionRequest,
  SuggestionResult,
} from '../suggestions/SuggestionProvider';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';
import type { FocusedMeetingProfileId } from '../../contracts/meeting/meetingProfile';

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
  locale: 'pt-BR' | 'en-US' = 'pt-BR',
): SpeechSegment {
  return {
    sessionId: config.sessionId,
    locale,
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
function setup(
  consent = true,
  maxRequests = 2,
  userContext?: string,
  locale: 'pt-BR' | 'en-US' = 'pt-BR',
  meetingProfile?: FocusedMeetingProfileId,
) {
  const session = new MeetingSession();
  const generate = vi
    .fn<(request: SuggestionRequest) => Promise<SuggestionResult>>()
    .mockResolvedValue({ ok: true, suggestions: [card] });
  const create = vi.fn(() => ({ generate }));
  const pipeline = new MeetingSuggestions(session, create);
  const sessionConfig = { ...config, locale };
  const start = () => {
    session.start({
      mode: 'apple-local',
      ...sessionConfig,
      consent: { capture: true, context: consent, remoteAudio: false },
    });
    pipeline.start(sessionConfig, {
      ...authorization,
      maxRequests,
      ...(userContext ? { userContext } : {}),
      ...(meetingProfile ? { meetingProfile } : {}),
    });
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
  it('publishes only evidence-backed live results, preserves pause and clears revocation lifecycle', async () => {
    const { pipeline, generate, session } = setup(true, 1);
    generate.mockResolvedValueOnce({
      ok: true,
      suggestions: [],
      resultUpdates: [
        {
          operation: 'upsert',
          key: 'prazo-projeto',
          kind: 'question',
          text: 'Qual é o prazo do projeto?',
          groundedIn: 'meeting',
          evidence: [{ source: 'mic', segmentId: 's1' }],
        },
        {
          operation: 'upsert',
          key: 'sem-suporte',
          kind: 'risk',
          text: 'Não deve aparecer.',
          groundedIn: 'inference',
          evidence: [{ source: 'mic', segmentId: 'inventado' }],
        },
      ],
    });
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate.mock.calls[0]?.[0].existingResults).toEqual([]);
    expect(pipeline.resultSnapshot().items).toHaveLength(1);
    expect(pipeline.resultSnapshot().items[0]).toMatchObject({
      key: 'prazo-projeto',
      evidence: [{ segmentId: 's1', startMs: 900, endMs: 1000 }],
    });

    session.pause();
    pipeline.pause();
    expect(pipeline.resultSnapshot().items).toHaveLength(1);
    session.revokeContext();
    pipeline.stop();
    expect(pipeline.resultSnapshot()).toEqual({ items: [] });
  });

  it('keeps an initial fragment without spending budget, then evaluates actionable accumulated context', async () => {
    const { pipeline, generate } = setup(true, 2);
    generate.mockResolvedValueOnce({ ok: true, suggestions: [] });

    pipeline.receive(speech(1, 'A equipe precisa analisar o trecho final.'));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(generate).not.toHaveBeenCalled();
    expect(pipeline.snapshot().remainingRequests).toBe(2);

    pipeline.receive(speech(2, 'Precisamos definir quem fará a revisão.'));
    await vi.advanceTimersByTimeAsync(1_999);
    expect(generate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(
      generate.mock.calls[0]?.[0].context.recent.map(({ text }) => text),
    ).toEqual([
      'A equipe precisa analisar o trecho final.',
      'Precisamos definir quem fará a revisão.',
    ]);
    expect(pipeline.snapshot().items).toEqual([]);

    pipeline.receive(speech(3, 'Quem confirmará a entrega com o cliente?'));
    await vi.advanceTimersByTimeAsync(1_999);
    expect(generate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(8_001);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(
      generate.mock.calls[1]?.[0].context.recent.map(({ text }) => text),
    ).toEqual([
      'A equipe precisa analisar o trecho final.',
      'Precisamos definir quem fará a revisão.',
      'Quem confirmará a entrega com o cliente?',
    ]);
  });

  it.each([
    [
      'pt-BR',
      'Estamos conversando sobre a entrega.',
      'Qual risco devemos avaliar?',
    ],
    [
      'en-US',
      'We are discussing the delivery.',
      'Which risk should we evaluate?',
    ],
  ] as const)(
    'applies automatic readiness without dropping the configured %s language',
    async (locale, fragment, actionable) => {
      const { pipeline, generate } = setup(true, 2, undefined, locale);
      pipeline.receive(speech(1, fragment, locale));
      await vi.advanceTimersByTimeAsync(10_000);
      expect(generate).not.toHaveBeenCalled();
      expect(pipeline.snapshot().remainingRequests).toBe(2);

      pipeline.receive(speech(2, actionable, locale));
      await vi.advanceTimersByTimeAsync(2_000);
      expect(generate).toHaveBeenCalledOnce();
      expect(generate.mock.calls[0]?.[0].language).toBe(locale);
      expect(
        generate.mock.calls[0]?.[0].context.recent.map(({ text }) => text),
      ).toEqual([fragment, actionable]);
    },
  );

  it('distinguishes final/trigger/debounce/preparation/transport and clears payload on pause', async () => {
    const { pipeline, generate, session } = setup();
    expect(pipeline.snapshot().diagnostics?.activity).toBe('waiting-final');
    pipeline.receive({ ...speech(), type: 'partial' });
    expect(pipeline.snapshot().diagnostics?.activity).toBe('waiting-final');
    pipeline.receive(speech(2, 'Obrigado.'));
    expect(pipeline.snapshot().diagnostics).toMatchObject({
      activity: 'waiting-trigger',
      lastTrigger: 'none',
    });
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
    await vi.advanceTimersByTimeAsync(2_000);
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
    await vi.advanceTimersByTimeAsync(2_000);
    expect(pipeline.snapshot().diagnostics?.lastAttempt).toMatchObject({
      number: 1,
      result: 'authentication',
      httpStatus: 401,
    });
    pipeline.receive(speech(2));
    await vi.advanceTimersByTimeAsync(2_000);
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
    await vi.advanceTimersByTimeAsync(2_000);
    const input = generate.mock.calls[0]?.[0];
    input?.onDispatch?.('synthetic-old-body');
    pipeline.receive(speech(2, 'Obrigado.'));
    expect(pipeline.snapshot().diagnostics?.lastAttempt?.result).toBe(
      'pending',
    );
    expect(input?.signal.aborted).toBe(false);
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
  it('does not call for ordinary finals and queues later actionable context while a request is running', async () => {
    const { pipeline, generate } = setup();
    let finish: (result: SuggestionResult) => void = () => {};
    generate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    pipeline.receive(speech(1, 'Bom dia a todos.'));
    pipeline.receive(speech(2, 'Estamos começando a reunião.'));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate).not.toHaveBeenCalled();
    pipeline.receive(speech(3, 'Qual risco devemos avaliar primeiro?'));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate).toHaveBeenCalledOnce();
    const first = generate.mock.calls[0]?.[0];
    expect(first?.context.recent).toHaveLength(3);
    pipeline.receive(speech(4, 'O projeto está em andamento.'));
    pipeline.receive(speech(5, 'Precisamos definir o próximo responsável.'));
    expect(first?.signal.aborted).toBe(false);
    expect(generate).toHaveBeenCalledOnce();
    finish({ ok: true, suggestions: [card] });
    await vi.advanceTimersByTimeAsync(10000);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(
      generate.mock.calls[1]?.[0].context.recent.map((item) => item.text),
    ).toContain('O projeto está em andamento.');
    expect(
      generate.mock.calls[1]?.[0].context.recent.map((item) => item.text),
    ).toContain('Precisamos definir o próximo responsável.');
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

  it('debounces finals, excludes partials and publishes dismissible retained cards', async () => {
    const { pipeline, generate } = setup();
    pipeline.receive({ ...speech(), type: 'partial' });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate).not.toHaveBeenCalled();
    pipeline.receive({ ...speech(), seq: 2 });
    await vi.advanceTimersByTimeAsync(1_999);
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
    await vi.advanceTimersByTimeAsync(2_000);
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

  it.each(['pause', 'stop', 'revoke'] as const)(
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
      await vi.advanceTimersByTimeAsync(2_000);
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
    await vi.advanceTimersByTimeAsync(2_000);
    session.stop();
    pipeline.stop();
    start();
    pipeline.receive(speech(2, 'Como podemos validar o protótipo fictício?'));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate).toHaveBeenCalledOnce();
    resolve({ ok: true, suggestions: [card] });
    await vi.advanceTimersByTimeAsync(0);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].context.recent).toHaveLength(1);
    expect(generate.mock.calls[1]?.[0].context.recent[0]?.text).toContain(
      'protótipo',
    );
  });

  it('keeps cards while ignoring duplicate, foreign and neutral finals', async () => {
    const { pipeline, generate } = setup();
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(2_000);
    pipeline.receive({ ...speech(), seq: 2 });
    pipeline.receive({ ...speech(3), sessionId: 'foreign' });
    expect(pipeline.snapshot().items).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(generate).toHaveBeenCalledOnce();
    pipeline.receive(speech(3, 'Obrigado.'));
    expect(pipeline.snapshot().items).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(generate).toHaveBeenCalledOnce();
  });

  it('advances context during silence, archives old speech, and retains cards without new speech', async () => {
    const { pipeline, generate } = setup();
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(30500);
    expect(pipeline.snapshot().items).toEqual([
      { ...card, id: 'suggestion-1', expiresAt: null },
    ]);
    await vi.advanceTimersByTimeAsync(240000);
    expect(pipeline.snapshot().items).toHaveLength(1);
    pipeline.receive({
      ...speech(2),
      timestampMs: 280000,
      startMs: 279000,
      endMs: 280000,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate.mock.calls[1]?.[0].context.recent).toHaveLength(1);
    expect(generate.mock.calls[1]?.[0].context.summary).toHaveLength(1);
  });

  it('counts safe failures as attempts without exposing provider details', async () => {
    const { pipeline, generate } = setup(true, 1);
    generate.mockResolvedValue({ ok: false, code: 'credentials-unavailable' });
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(2_000);
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

it('retains every distinct card after budget exhaustion without a session TTL', async () => {
  const { pipeline, generate } = setup(true, 3);
  pipeline.receive(speech());
  await vi.advanceTimersByTimeAsync(2_000);
  const first = pipeline.snapshot().items[0];
  await vi.advanceTimersByTimeAsync(60000);
  pipeline.receive(speech(2, 'Outro assunto sintético.'));
  await vi.advanceTimersByTimeAsync(2_000);
  expect(pipeline.snapshot().items).toEqual([first]);
  for (const seq of [3, 4]) {
    generate.mockResolvedValueOnce({
      ok: true,
      suggestions: [{ ...card, body: `Body ${seq}` }],
    });
    pipeline.receive(
      speech(seq, `Precisamos revisar a entrega sintética ${seq}.`),
    );
    await vi.advanceTimersByTimeAsync(10000);
  }
  expect(pipeline.snapshot()).toMatchObject({
    status: 'exhausted',
    items: [first, { body: 'Body 3' }, { body: 'Body 4' }],
  });
  await vi.advanceTimersByTimeAsync(3600000);
  expect(pipeline.snapshot().items).toHaveLength(3);
  expect(generate).toHaveBeenCalledTimes(3);
});

it.each(['pause', 'stop', 'revoke', 'restart'] as const)(
  'clears retained cards and suppression on %s without reusing old IDs',
  async (action) => {
    const { pipeline, session, start } = setup(true, 3);
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(2_000);
    const oldId = pipeline.snapshot().items[0]?.id ?? '';
    expect(oldId).not.toBe('');
    if (action === 'pause') {
      session.pause();
      pipeline.pause();
    } else if (action === 'revoke') {
      session.revokeContext();
      pipeline.stop();
    } else {
      session.stop();
      pipeline.stop();
    }
    expect(pipeline.snapshot().items).toEqual([]);
    expect(
      pipeline.snapshot().diagnostics?.lastAttempt?.requestBody ?? null,
    ).toBeNull();
    if (action === 'pause') {
      session.resume();
      pipeline.resume();
    } else {
      if (action === 'revoke') session.stop();
      start();
    }
    expect(pipeline.snapshot().items).toEqual([]);
    pipeline.receive(speech(2, 'Qual é a nova pergunta sintética?'));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(pipeline.snapshot().items).toHaveLength(1);
    expect(pipeline.snapshot().items[0]?.id).not.toBe(oldId);
    pipeline.dismiss(oldId);
    expect(pipeline.snapshot().items).toHaveLength(1);
  },
);

it.each(['stop', 'revoke'] as const)(
  'clears optional context after %s and keeps the same request budget across pause',
  async (action) => {
    const userContext = 'Tema privado sintético; papel de designer.';
    const { pipeline, session, generate, create } = setup(true, 2, userContext);
    expect(create).toHaveBeenCalledWith(authorization, expect.any(Function));
    await vi.advanceTimersByTimeAsync(10000);
    expect(generate).not.toHaveBeenCalled();
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate.mock.calls[0]?.[0].userContext).toBe(userContext);
    expect(JSON.stringify(generate.mock.calls[0]?.[0].context)).not.toContain(
      userContext,
    );
    session.pause();
    pipeline.pause();
    session.resume();
    pipeline.resume();
    pipeline.receive(speech(2));
    await vi.advanceTimersByTimeAsync(11000);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].userContext).toBe(userContext);
    pipeline.receive(speech(3));
    await vi.advanceTimersByTimeAsync(11000);
    expect(generate).toHaveBeenCalledTimes(2);
    if (action === 'revoke') session.revokeContext();
    else session.stop();
    pipeline.stop();
    expect(JSON.stringify(pipeline.snapshot())).not.toContain(userContext);
    session.stop();
    session.start({
      mode: 'apple-local',
      ...config,
      consent: { capture: true, context: true, remoteAudio: false },
    });
    pipeline.start(config, authorization);
    pipeline.receive(speech());
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[2]?.[0]).not.toHaveProperty('userContext');
    pipeline.stop();
  },
);

it('does not retain or forward optional context without text consent', async () => {
  const { pipeline, create, generate } = setup(
    false,
    2,
    'private synthetic context',
  );
  pipeline.receive(speech());
  await vi.advanceTimersByTimeAsync(10000);
  expect(create).not.toHaveBeenCalled();
  expect(generate).not.toHaveBeenCalled();
  expect(JSON.stringify(pipeline.snapshot())).not.toContain(
    'private synthetic context',
  );
});

it('switches focused profiles between sessions and clears the previous runtime choice', async () => {
  const { pipeline, session, generate } = setup(
    true,
    2,
    undefined,
    'pt-BR',
    'discovery',
  );
  pipeline.receive(speech());
  await vi.advanceTimersByTimeAsync(2_000);
  expect(generate.mock.calls[0]?.[0].meetingProfile).toBe('discovery');

  session.stop();
  pipeline.stop();
  session.start({
    mode: 'apple-local',
    ...config,
    consent: { capture: true, context: true, remoteAudio: false },
  });
  pipeline.start(config, {
    ...authorization,
    meetingProfile: 'technical-review',
  });
  pipeline.receive(speech(2));
  await vi.advanceTimersByTimeAsync(2_000);
  expect(generate.mock.calls[1]?.[0].meetingProfile).toBe('technical-review');

  session.revokeContext();
  pipeline.stop();
  session.stop();
  session.start({
    mode: 'apple-local',
    ...config,
    consent: { capture: true, context: true, remoteAudio: false },
  });
  pipeline.start(config, authorization);
  pipeline.receive(speech(3));
  await vi.advanceTimersByTimeAsync(2_000);
  expect(generate.mock.calls[2]?.[0]).not.toHaveProperty('meetingProfile');
});
