// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { parseTranscriptionEvent } from '../../src/contracts/native/protocol';
import { ContextManager } from '../../src/core/meeting/ContextManager';
import { TriggerEngine } from '../../src/core/suggestions/TriggerEngine';
import { MockSuggestionProvider } from '../../src/infrastructure/ai/MockSuggestionProvider';
import type { TriggerInput } from '../../src/core/suggestions/TriggerEngine';

it('replays synthetic turns through context, triggers and an offline provider, preserving deliberate silence', async () => {
  const context = new ContextManager();
  context.start({
    sessionId: 'synthetic',
    sources: ['system'],
    locale: 'pt-BR',
  });
  const engine = new TriggerEngine();
  const provider = new MockSuggestionProvider();
  const generate = vi.spyOn(provider, 'generate');
  const signal = new AbortController().signal;

  // Test-only composition: real session authorization/scheduling is T024.
  async function dispatch(input: TriggerInput) {
    if (input.type !== 'manual' && input.type !== 'silence') {
      if (!context.receive(input)) return;
    }
    const trigger = engine.evaluate(input);
    const snapshot = context.snapshot();
    if (trigger !== 'none' && snapshot) {
      const result = await provider.generate({
        context: snapshot,
        language: 'pt-BR',
        signal,
      });
      // A trigger permits evaluation; it never forces a card or invents content.
      expect(result).toEqual({ ok: true, suggestions: [] });
    }
    return trigger;
  }

  expect(await dispatch({ type: 'silence' })).toBe('none');
  expect(generate).not.toHaveBeenCalled();
  expect(await dispatch({ type: 'manual' })).toBe('manual');
  expect(generate.mock.calls[0]?.[0].context).toMatchObject({
    recent: [],
    summary: [],
  });

  const turns = [
    ['partial', 'Quais riscos temos?', 'none'],
    ['final', 'Tudo certo, obrigado.', 'none'],
    ['final', 'Quais riscos temos ao migrar?', 'question'],
    ['final', 'Não concordo com esse prazo.', 'objection'],
    ['final', 'Vou revisar a proposta amanhã.', 'commitment'],
    ['final', 'Obrigado pela ajuda.', 'none'],
  ] as const;
  let expectedCalls = 1;
  for (const [index, [type, text, expected]] of turns.entries()) {
    const input = parseTranscriptionEvent({
      version: 1,
      sessionId: 'synthetic',
      source: 'system',
      locale: 'pt-BR',
      seq: index + 1,
      type,
      segmentId: index < 2 ? 'interrupted' : `turn-${index}`,
      startMs: index < 2 ? 0 : index * 1000,
      endMs: (index + 1) * 1000,
      timestampMs: (index + 1) * 1000,
      text,
    });
    expect(await dispatch(input)).toBe(expected);
    if (expected !== 'none') expectedCalls += 1;
    expect(generate).toHaveBeenCalledTimes(expectedCalls);
  }
  expect(
    generate.mock.calls[1]?.[0].context.recent.map(({ text }) => text),
  ).toEqual(['Tudo certo, obrigado.', 'Quais riscos temos ao migrar?']);

  context.advanceTo(250_000);
  expect(context.snapshot()?.recent).toEqual([]);
  expect(context.snapshot()?.summary.length).toBeGreaterThan(0);
  // Historic questions in the summary cannot retrigger on silence.
  expect(await dispatch({ type: 'silence' })).toBe('none');
  expect(generate).toHaveBeenCalledTimes(4);
  expect(await dispatch({ type: 'manual' })).toBe('manual');
  expect(generate).toHaveBeenCalledTimes(5);
});
