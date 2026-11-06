import { describe, expect, it } from 'vitest';
import {
  parseSuggestionBatch,
  parseSuggestion,
  parseSuggestionContent,
  SUGGESTION_CATEGORIES,
} from './suggestion';

const card = {
  category: 'question',
  title: 'Confirme',
  body: 'Qual é o prazo?',
  groundedIn: 'inference',
};

describe('suggestion content and batches', () => {
  it.each([0, 1, 2])(
    'accepts %i contents without model-controlled IDs/expiry',
    (count) => {
      const batch = {
        suggestions: Array.from({ length: count }, () => ({ ...card })),
      };
      expect(parseSuggestionBatch(batch)).toEqual(batch.suggestions);
    },
  );
  it.each(SUGGESTION_CATEGORIES)(
    'shares validation with existing cards for %s',
    (category) => {
      const content = { ...card, category, groundedIn: 'meeting' };
      expect(parseSuggestionContent(content)).toEqual(content);
      expect(
        parseSuggestion({ ...content, id: 'local-1', expiresAt: 30000 }),
      ).toEqual({ ...content, id: 'local-1', expiresAt: 30000 });
    },
  );
  it.each([
    null,
    [],
    {},
    { suggestions: null },
    { suggestions: [card, card, card] },
    { suggestions: [], extra: true },
    ...[
      { ...card, id: 'remote' },
      { ...card, expiresAt: 100 },
      { ...card, category: 'unknown' },
      { ...card, groundedIn: 'certain' },
      { ...card, title: ' ' },
      { ...card, body: '\n' },
      { ...card, title: 'a'.repeat(81) },
      { ...card, body: 'a'.repeat(301) },
      { ...card, body: 7 },
      { title: 'missing fields' },
      null,
    ].map((item) => ({ suggestions: [item] })),
  ])('rejects malformed/oversized output %#', (batch) => {
    expect(parseSuggestionBatch(batch)).toBeNull();
  });
  it('copies outputs defensively and accepts exact length boundaries', () => {
    const content = { ...card, title: 'a'.repeat(80), body: 'a'.repeat(300) };
    const parsed = parseSuggestionBatch({ suggestions: [content] });
    expect(parsed).toEqual([content]);
    content.title = 'mutated';
    expect(parsed?.[0]?.title).toHaveLength(80);
  });
});
