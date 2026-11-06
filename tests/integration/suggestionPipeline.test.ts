// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { ContextManager } from '../../src/core/meeting/ContextManager';
import { SuggestionStore } from '../../src/core/suggestions/SuggestionStore';
import { parseSuggestions } from '../../src/contracts/meeting/suggestion';
import { OpenAISuggestionProvider } from '../../src/infrastructure/ai/OpenAISuggestionProvider';
import { MockSuggestionProvider } from '../../src/infrastructure/ai/MockSuggestionProvider';
import type { SuggestionProvider } from '../../src/core/suggestions/SuggestionProvider';

it('passes bounded context through interchangeable providers into existing card DTOs, recovering after failures', async () => {
  const context = new ContextManager();
  context.start({
    sessionId: 'synthetic',
    sources: ['system'],
    locale: 'pt-BR',
  });
  context.receive({
    version: 1,
    sessionId: 'synthetic',
    source: 'system',
    locale: 'pt-BR',
    seq: 1,
    type: 'final',
    segmentId: 'one',
    startMs: 0,
    endMs: 1000,
    timestampMs: 1000,
    text: 'Vamos migrar o módulo.',
  });
  context.advanceTo(250_000);
  context.receive({
    version: 1,
    sessionId: 'synthetic',
    source: 'system',
    locale: 'pt-BR',
    seq: 2,
    type: 'final',
    segmentId: 'two',
    startMs: 250_000,
    endMs: 251_000,
    timestampMs: 251_000,
    text: 'Quais riscos precisamos avaliar?',
  });
  const snapshot = context.snapshot();
  if (!snapshot) throw new Error('Missing context');
  expect(snapshot.summary).toHaveLength(1);
  expect(snapshot.recent).toHaveLength(1);
  const suggestions = [
    {
      category: 'question',
      title: 'Dependências',
      body: 'Quais dependências devem ser verificadas?',
      groundedIn: 'inference',
    },
  ];
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('private error', { status: 503 }))
    .mockResolvedValueOnce(
      Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [
              { type: 'output_text', text: JSON.stringify({ suggestions }) },
            ],
          },
        ],
      }),
    );
  const real: SuggestionProvider = new OpenAISuggestionProvider({
    model: 'synthetic-model',
    getApiKey: () => Promise.resolve('synthetic-key'),
    isAuthorized: () => true,
    fetch: transport,
  });
  const mock: SuggestionProvider = new MockSuggestionProvider({ suggestions });
  const store = new SuggestionStore(() => 1000);
  const request = {
    context: snapshot,
    language: 'pt-BR' as const,
    signal: new AbortController().signal,
  };
  expect(await real.generate(request)).toEqual({
    ok: false,
    code: 'unavailable',
  });
  expect(parseSuggestions(store.snapshot())).toEqual([]);
  const recovered = await real.generate(request);
  expect(recovered).toEqual(await mock.generate(request));
  if (!recovered.ok) throw new Error('Expected recovery');
  recovered.suggestions.forEach((content, i) =>
    store.add(`local-${i}`, content),
  );
  expect(parseSuggestions(store.snapshot())).toEqual([
    { ...suggestions[0], id: 'local-0', expiresAt: 31000 },
  ]);
  expect(transport.mock.calls[1]?.[1]?.body).toContain(
    'Vamos migrar o módulo.',
  );
  expect(transport.mock.calls[1]?.[1]?.body).toContain(
    'Quais riscos precisamos avaliar?',
  );
  context.clear();
  store.clear();
  expect(context.snapshot()).toBeNull();
  expect(store.snapshot()).toEqual([]);
});
