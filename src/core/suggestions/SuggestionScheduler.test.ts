// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuggestionScheduler } from './SuggestionScheduler';
import type { SuggestionPolicy } from './SuggestionScheduler';
import type {
  SuggestionProvider,
  SuggestionResult,
} from './SuggestionProvider';
import type { MeetingContext } from '../meeting/ContextManager';

const content = {
  category: 'question' as const,
  title: 'Prazo',
  body: 'Qual é o prazo?',
  groundedIn: 'inference' as const,
};
const success: SuggestionResult = { ok: true, suggestions: [content] };
const context: MeetingContext = { recent: [], summary: [] };

function setup(policy: Partial<SuggestionPolicy> = {}, continuous = false) {
  const generate = vi
    .fn<SuggestionProvider['generate']>()
    .mockResolvedValue(success);
  const authorized = vi.fn(() => true);
  const scheduler = new SuggestionScheduler(
    { generate },
    authorized,
    'pt-BR',
    { debounceMs: 500, ...policy },
    continuous,
  );
  const session = new AbortController();
  scheduler.start(session.signal);
  return { scheduler, generate, authorized, session };
}

function deferred() {
  let resolve: (result: SuggestionResult) => void = () => {
    throw new Error('Deferred not initialized');
  };
  const promise = new Promise<SuggestionResult>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('suggestion scheduling', () => {
  it('restarts the continuous debounce after each new context and waits two seconds', async () => {
    const { scheduler, generate } = setup({ debounceMs: 2_000 }, true);
    scheduler.submit(context, 1, 'automatic');
    await vi.advanceTimersByTimeAsync(1_500);
    scheduler.submit(context, 2, 'automatic');
    await vi.advanceTimersByTimeAsync(1_999);
    expect(generate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledOnce();
  });

  it('debounces a burst to the latest context at the exact boundary', async () => {
    const { scheduler, generate } = setup();
    scheduler.submit(context, 1, 'question');
    await vi.advanceTimersByTimeAsync(400);
    scheduler.submit(context, 2, 'objection');
    await vi.advanceTimersByTimeAsync(499);
    expect(generate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(scheduler.snapshot()).toHaveLength(1);
  });

  it('ignores duplicate or out-of-order automatic revisions without postponing work', async () => {
    const { scheduler, generate } = setup();
    scheduler.submit(context, 2, 'question');
    await vi.advanceTimersByTimeAsync(499);
    scheduler.submit(context, 2, 'question');
    scheduler.submit(context, 1, 'none');
    await vi.advanceTimersByTimeAsync(1);
    scheduler.submit(context, 2, 'question');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(scheduler.snapshot()).toHaveLength(1);
  });

  it('retains only the latest pending turn during cooldown, measured from dispatch', async () => {
    const { scheduler, generate } = setup();
    scheduler.submit(context, 1, 'question');
    await vi.advanceTimersByTimeAsync(500);
    scheduler.submit(context, 2, 'objection');
    await vi.advanceTimersByTimeAsync(9000);
    scheduler.submit(context, 3, 'commitment');
    await vi.advanceTimersByTimeAsync(999);
    expect(generate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(scheduler.snapshot()).toEqual([]); // Same card remains suppressed.
  });

  it('manual bypasses debounce/cooldown and replaces pending automatic work', async () => {
    const { scheduler, generate } = setup();
    scheduler.submit(context, 1, 'question');
    scheduler.submit(context, 1, 'manual');
    expect(generate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    scheduler.submit(context, 1, 'manual');
    await vi.advanceTimersByTimeAsync(500);
    expect(generate).toHaveBeenCalledTimes(2);
    scheduler.submit(context, 2, 'question');
    await vi.advanceTimersByTimeAsync(9499);
    expect(generate).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it('none cancels pending work and invalidates already visible cards', async () => {
    const { scheduler, generate } = setup();
    scheduler.submit(context, 1, 'question');
    scheduler.submit(context, 2, 'none');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(generate).not.toHaveBeenCalled();
    scheduler.submit(context, 3, 'manual');
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.snapshot()).toHaveLength(1);
    scheduler.submit(context, 4, 'none');
    expect(scheduler.snapshot()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels an old response without overlapping calls when the provider ignores abort', async () => {
    const { scheduler, generate } = setup({ cooldownMs: 0 });
    const old = deferred();
    const newest = deferred();
    generate
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(newest.promise);
    scheduler.submit(context, 1, 'manual');
    scheduler.submit(context, 2, 'question');
    scheduler.submit(context, 3, 'manual');
    await vi.advanceTimersByTimeAsync(1000);
    expect(generate.mock.calls[0]?.[0].signal.aborted).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    old.resolve(success);
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.snapshot()).toEqual([]);
    expect(generate).toHaveBeenCalledTimes(2);
    newest.resolve({
      ok: true,
      suggestions: [{ ...content, body: 'Novo assunto' }],
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.snapshot().map(({ body }) => body)).toEqual([
      'Novo assunto',
    ]);
  });

  it.each(['stop', 'abort', 'invalidate'] as const)(
    '%s discards delayed output and clears timers',
    async (action) => {
      const { scheduler, generate, session } = setup();
      const delayed = deferred();
      generate.mockReturnValueOnce(delayed.promise);
      scheduler.submit(context, 1, 'manual');
      if (action === 'abort') session.abort();
      else scheduler[action]();
      expect(vi.getTimerCount()).toBe(0);
      expect(generate.mock.calls[0]?.[0].signal.aborted).toBe(true);
      delayed.resolve(success);
      await vi.advanceTimersByTimeAsync(0);
      expect(scheduler.snapshot()).toEqual([]);
    },
  );

  it('serializes across restart and rejects old session replies even with the same revision', async () => {
    const { scheduler, generate, session } = setup();
    const delayed = deferred();
    generate.mockReturnValueOnce(delayed.promise);
    scheduler.submit(context, 1, 'manual');
    session.abort();
    scheduler.start(new AbortController().signal);
    scheduler.submit(context, 1, 'manual');
    expect(generate).toHaveBeenCalledTimes(1);
    delayed.resolve({
      ok: true,
      suggestions: [{ ...content, body: 'Old session' }],
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(scheduler.snapshot().map(({ body }) => body)).toEqual([
      content.body,
    ]);
    // The detached old signal cannot stop the replacement session.
    session.abort();
    expect(scheduler.snapshot()).toHaveLength(1);
  });

  it('stop clears pending work, dedup history and cooldown while IDs remain distinct', async () => {
    const { scheduler, generate } = setup();
    scheduler.submit(context, 1, 'manual');
    await vi.advanceTimersByTimeAsync(0);
    const firstId = scheduler.snapshot()[0]?.id;
    scheduler.submit(context, 2, 'question');
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(generate).toHaveBeenCalledTimes(1);
    scheduler.start(new AbortController().signal);
    scheduler.submit(context, 0, 'manual');
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.snapshot()).toHaveLength(1);
    expect(scheduler.snapshot()[0]?.id).not.toBe(firstId);
    if (firstId) scheduler.dismiss(firstId);
    expect(scheduler.snapshot()).toHaveLength(1);
  });

  it('never dispatches while inactive or with an already aborted session', async () => {
    const { scheduler, generate, session } = setup();
    scheduler.stop();
    scheduler.submit(context, 1, 'manual');
    session.abort();
    scheduler.start(session.signal);
    scheduler.submit(context, 1, 'manual');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(generate).not.toHaveBeenCalled();
  });

  it.each(['submission', 'dispatch', 'completion'] as const)(
    'checks authorization at %s, including manual requests',
    async (stage) => {
      const { scheduler, generate, authorized } = setup();
      const delayed = deferred();
      generate.mockReturnValueOnce(delayed.promise);
      if (stage === 'submission') authorized.mockReturnValue(false);
      scheduler.submit(
        context,
        1,
        stage === 'dispatch' ? 'question' : 'manual',
      );
      authorized.mockReturnValue(false);
      if (stage === 'completion') delayed.resolve(success);
      await vi.advanceTimersByTimeAsync(1000);
      expect(generate).toHaveBeenCalledTimes(stage === 'completion' ? 1 : 0);
      expect(scheduler.snapshot()).toEqual([]);
      authorized.mockReturnValue(true);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(generate).toHaveBeenCalledTimes(stage === 'completion' ? 1 : 0);
    },
  );

  it('hides existing cards when authorization is revoked', async () => {
    const { scheduler, authorized } = setup();
    scheduler.submit(context, 1, 'manual');
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.snapshot()).toHaveLength(1);
    authorized.mockReturnValue(false);
    expect(scheduler.snapshot()).toEqual([]);
  });

  it.each([999, 1000, 1001])(
    'accepts output only before response deadline (%i ms)',
    async (age) => {
      const { scheduler, generate } = setup({ maxResponseAgeMs: 1000 });
      const delayed = deferred();
      generate.mockReturnValueOnce(delayed.promise);
      scheduler.submit(context, 1, 'manual');
      await vi.advanceTimersByTimeAsync(age);
      delayed.resolve(success);
      await vi.advanceTimersByTimeAsync(0);
      expect(scheduler.snapshot()).toHaveLength(age < 1000 ? 1 : 0);
      expect(generate.mock.calls[0]?.[0].signal.aborted).toBe(age >= 1000);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('rejects a stale reply even if the clock advances before the timeout callback', async () => {
    const { scheduler, generate } = setup({ maxResponseAgeMs: 1000 });
    const delayed = deferred();
    generate.mockReturnValueOnce(delayed.promise);
    scheduler.submit(context, 1, 'manual');
    vi.setSystemTime(2000);
    delayed.resolve(success);
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.snapshot()).toEqual([]);
  });

  it.each(['failure', 'throw', 'silent'] as const)(
    'recovers after %s without retrying automatically',
    async (kind) => {
      const { scheduler, generate } = setup();
      if (kind === 'throw')
        generate.mockImplementationOnce(() => {
          throw new Error('private payload');
        });
      else
        generate.mockResolvedValueOnce(
          kind === 'failure'
            ? { ok: false, code: 'network' }
            : { ok: true, suggestions: [] },
        );
      scheduler.submit(context, 1, 'manual');
      await vi.advanceTimersByTimeAsync(10_000);
      expect(scheduler.snapshot()).toEqual([]);
      expect(generate).toHaveBeenCalledTimes(1);
      scheduler.submit(context, 1, 'manual');
      await vi.advanceTimersByTimeAsync(0);
      expect(scheduler.snapshot()).toHaveLength(1);
    },
  );

  it('deduplicates within and across batches and expires without new speech', async () => {
    const { scheduler, generate } = setup({ ttlMs: 1000 });
    generate.mockResolvedValue({
      ok: true,
      suggestions: [content, { ...content, body: '  QUAL É   O PRAZO? ' }],
    });
    scheduler.submit(context, 1, 'manual');
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.snapshot()).toHaveLength(1);
    const id = scheduler.snapshot()[0]?.id;
    if (id) scheduler.dismiss(id);
    scheduler.submit(context, 1, 'manual');
    await vi.advanceTimersByTimeAsync(999);
    expect(scheduler.snapshot()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    scheduler.submit(context, 1, 'manual');
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.snapshot()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(scheduler.snapshot()).toEqual([]);
  });

  it('copies queued context and preserves the configured language', async () => {
    const generate = vi
      .fn<SuggestionProvider['generate']>()
      .mockResolvedValue(success);
    const scheduler = new SuggestionScheduler(
      { generate },
      () => true,
      'en-US',
    );
    scheduler.start(new AbortController().signal);
    const input: MeetingContext = { recent: [], summary: [] };
    scheduler.submit(input, 1, 'question');
    // Arrays are independently owned even when the caller reuses its snapshot.
    expect(input).toEqual(context);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(generate.mock.calls[0]?.[0].context.recent).not.toBe(input.recent);
    expect(generate.mock.calls[0]?.[0].context.summary).not.toBe(input.summary);
    expect(generate.mock.calls[0]?.[0].language).toBe('en-US');
  });

  it('rejects invalid policies/revisions and permits zero scheduling delays', () => {
    const { generate, scheduler } = setup();
    for (const key of ['debounceMs', 'cooldownMs', 'ttlMs', 'maxResponseAgeMs'])
      for (const value of [-1, 1.5, NaN, Infinity, 2_147_483_648])
        expect(
          () =>
            new SuggestionScheduler({ generate }, () => true, 'pt-BR', {
              [key]: value,
            }),
        ).toThrow('Invalid suggestion policy');
    for (const key of ['ttlMs', 'maxResponseAgeMs'])
      expect(
        () =>
          new SuggestionScheduler({ generate }, () => true, 'pt-BR', {
            [key]: 0,
          }),
      ).toThrow();
    for (const revision of [-1, 0.5, Infinity, NaN])
      expect(() => scheduler.submit(context, revision, 'manual')).toThrow(
        'Invalid context revision',
      );
    expect(() => setup({ debounceMs: 0, cooldownMs: 0 })).not.toThrow();
  });
});
