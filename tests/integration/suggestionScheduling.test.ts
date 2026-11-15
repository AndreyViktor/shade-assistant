// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { parseTranscriptionEvent } from '../../src/contracts/native/protocol';
import { parseSuggestions } from '../../src/contracts/meeting/suggestion';
import { ContextManager } from '../../src/core/meeting/ContextManager';
import { TriggerEngine } from '../../src/core/suggestions/TriggerEngine';
import { SuggestionScheduler } from '../../src/core/suggestions/SuggestionScheduler';
import { MockSuggestionProvider } from '../../src/infrastructure/ai/MockSuggestionProvider';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('replays synthetic finals through context, trigger, scheduling and card DTOs entirely offline', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const context = new ContextManager();
  context.start({
    sessionId: 'synthetic',
    sources: ['system'],
    locale: 'pt-BR',
  });
  const trigger = new TriggerEngine();
  const mock = new MockSuggestionProvider({
    suggestions: [
      {
        category: 'question',
        title: 'DEMO — prazo',
        body: 'Qual dependência precisa ser validada?',
        groundedIn: 'inference',
      },
    ],
  });
  const generate = vi.spyOn(mock, 'generate');
  const scheduler = new SuggestionScheduler(mock, () => true);
  const session = new AbortController();
  scheduler.start(session.signal);
  let revision = 0;

  // Test-only host wiring. Real session/consent/budget and overlay stay in T024.
  function speech(
    seq: number,
    text: string,
    type: 'final' | 'partial' = 'final',
  ) {
    const event = parseTranscriptionEvent({
      version: 1,
      sessionId: 'synthetic',
      source: 'system',
      locale: 'pt-BR',
      seq,
      type,
      segmentId: `turn-${seq}`,
      text,
      startMs: seq * 1000,
      endMs: seq * 1000 + 500,
      timestampMs: seq * 1000 + 500,
    });
    if (!context.receive(event) || event.type !== 'final') return;
    const snapshot = context.snapshot();
    if (snapshot)
      scheduler.submit(snapshot, ++revision, trigger.evaluate(event));
  }
  speech(1, 'Quais riscos temos?', 'partial');
  speech(2, 'Tudo certo, obrigado.');
  await vi.advanceTimersByTimeAsync(1000);
  expect(generate).not.toHaveBeenCalled();
  speech(3, 'Quais riscos temos ao migrar?');
  await vi.advanceTimersByTimeAsync(300);
  speech(4, 'Não concordo com esse prazo.');
  await vi.advanceTimersByTimeAsync(1_999);
  expect(generate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(generate.mock.calls[0]?.[0].context.recent.at(-1)?.text).toBe(
    'Não concordo com esse prazo.',
  );
  expect(parseSuggestions(scheduler.snapshot())).toHaveLength(1);

  speech(4, 'Não concordo com esse prazo.'); // Replayed seq never invalidates cards.
  expect(scheduler.snapshot()).toHaveLength(1);
  speech(5, 'Vou revisar a proposta amanhã.');
  expect(scheduler.snapshot()).toEqual([]);
  await vi.advanceTimersByTimeAsync(9999);
  expect(generate).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(generate).toHaveBeenCalledTimes(2);
  expect(scheduler.snapshot()).toEqual([]); // Duplicate provider output suppressed.

  speech(6, 'Esse assunto foi encerrado.');
  await vi.advanceTimersByTimeAsync(20_000);
  expect(generate).toHaveBeenCalledTimes(2);
  const snapshot = context.snapshot();
  if (!snapshot) throw new Error('Missing synthetic context');
  scheduler.submit(snapshot, revision, trigger.evaluate({ type: 'manual' }));
  await vi.advanceTimersByTimeAsync(0);
  expect(generate).toHaveBeenCalledTimes(3);
  expect(parseSuggestions(scheduler.snapshot())).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(scheduler.snapshot()).toEqual([]);
  session.abort();
  context.clear();
  scheduler.submit(snapshot, revision + 1, 'manual');
  expect(generate).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});
