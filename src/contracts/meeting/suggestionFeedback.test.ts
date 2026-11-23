import { describe, expect, it } from 'vitest';
import {
  createSuggestionFeedbackExport,
  emptySuggestionFeedback,
  parseSuggestionFeedback,
} from './suggestionFeedback';

describe('suggestion feedback contract', () => {
  it('accepts consistent unique ratings and rejects malformed aggregates', () => {
    const feedback = {
      ratedCards: 2,
      counts: { useful: 1, irrelevant: 0, incorrect: 0, repeated: 1 },
      ratings: [
        { suggestionId: 'suggestion-1', value: 'useful' },
        { suggestionId: 'suggestion-2', value: 'repeated' },
      ],
    };
    expect(parseSuggestionFeedback(feedback)).toEqual(feedback);
    for (const invalid of [
      { ...feedback, ratedCards: 3 },
      { ...feedback, counts: { ...feedback.counts, useful: 2 } },
      { ...feedback, counts: { ...feedback.counts, private: 1 } },
      { ...feedback, ratings: [...feedback.ratings, feedback.ratings[0]] },
      { ...feedback, ratings: [{ suggestionId: 'x', value: 'comment' }] },
      { ...feedback, speech: 'conteúdo privado' },
    ])
      expect(parseSuggestionFeedback(invalid)).toBeNull();
  });

  it('exports only anonymous counts and a timestamp', () => {
    const feedback = emptySuggestionFeedback();
    feedback.ratedCards = 1;
    feedback.counts.incorrect = 1;
    feedback.ratings = [
      { suggestionId: 'private-card-id', value: 'incorrect' },
    ];
    const exported = createSuggestionFeedbackExport(
      feedback,
      '2026-11-23T12:00:00.000Z',
    );
    expect(exported).toEqual({
      schema: 'meeting-copilot.suggestion-feedback.v1',
      exportedAt: '2026-11-23T12:00:00.000Z',
      metrics: {
        ratedCards: 1,
        counts: { useful: 0, irrelevant: 0, incorrect: 1, repeated: 0 },
      },
    });
    expect(JSON.stringify(exported)).not.toMatch(
      /private-card-id|speech|context|title|body|model/i,
    );
  });
});
