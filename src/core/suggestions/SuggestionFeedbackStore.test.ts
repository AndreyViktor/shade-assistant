import { describe, expect, it } from 'vitest';
import { SuggestionFeedbackStore } from './SuggestionFeedbackStore';

describe('SuggestionFeedbackStore', () => {
  it('deduplicates the card and replaces its previous classification', () => {
    const store = new SuggestionFeedbackStore();
    store.rate('suggestion-1', 'useful');
    store.rate('suggestion-1', 'useful');
    store.rate('suggestion-2', 'repeated');
    expect(store.snapshot()).toMatchObject({
      ratedCards: 2,
      counts: { useful: 1, irrelevant: 0, incorrect: 0, repeated: 1 },
    });
    store.rate('suggestion-1', 'incorrect');
    expect(store.snapshot()).toEqual({
      ratedCards: 2,
      counts: { useful: 0, irrelevant: 0, incorrect: 1, repeated: 1 },
      ratings: [
        { suggestionId: 'suggestion-1', value: 'incorrect' },
        { suggestionId: 'suggestion-2', value: 'repeated' },
      ],
    });
  });

  it('clears every in-memory rating', () => {
    const store = new SuggestionFeedbackStore();
    store.rate('suggestion-1', 'irrelevant');
    store.clear();
    expect(store.snapshot()).toEqual({
      ratedCards: 0,
      counts: { useful: 0, irrelevant: 0, incorrect: 0, repeated: 0 },
      ratings: [],
    });
  });
});
