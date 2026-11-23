import { isSuggestionId, SUGGESTION_SESSION_CARD_LIMIT } from './suggestion';
import { hasExactKeys } from '../validation';

export const SUGGESTION_FEEDBACK_VALUES = [
  'useful',
  'irrelevant',
  'incorrect',
  'repeated',
] as const;
export type SuggestionFeedbackValue =
  (typeof SUGGESTION_FEEDBACK_VALUES)[number];

export type SuggestionRating = {
  suggestionId: string;
  value: SuggestionFeedbackValue;
};

export type SuggestionFeedbackMetrics = {
  ratedCards: number;
  counts: Record<SuggestionFeedbackValue, number>;
};

export type SuggestionFeedbackSnapshot = SuggestionFeedbackMetrics & {
  ratings: SuggestionRating[];
};

export type SuggestionFeedbackExport = {
  schema: 'meeting-copilot.suggestion-feedback.v1';
  exportedAt: string;
  metrics: SuggestionFeedbackMetrics;
};

export function emptySuggestionFeedback(): SuggestionFeedbackSnapshot {
  return {
    ratedCards: 0,
    counts: { useful: 0, irrelevant: 0, incorrect: 0, repeated: 0 },
    ratings: [],
  };
}

export function isSuggestionFeedbackValue(
  value: unknown,
): value is SuggestionFeedbackValue {
  return SUGGESTION_FEEDBACK_VALUES.some((candidate) => candidate === value);
}

export function parseSuggestionFeedback(
  value: unknown,
): SuggestionFeedbackSnapshot | null {
  if (!hasExactKeys(value, ['ratedCards', 'counts', 'ratings'])) return null;
  const ratedCards = value.ratedCards;
  if (
    !hasExactKeys(value.counts, SUGGESTION_FEEDBACK_VALUES) ||
    !Array.isArray(value.ratings) ||
    value.ratings.length > SUGGESTION_SESSION_CARD_LIMIT ||
    typeof ratedCards !== 'number' ||
    !Number.isSafeInteger(ratedCards) ||
    ratedCards < 0 ||
    ratedCards !== value.ratings.length
  )
    return null;
  const counts = emptySuggestionFeedback().counts;
  for (const feedback of SUGGESTION_FEEDBACK_VALUES) {
    const count = value.counts[feedback];
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0)
      return null;
    counts[feedback] = count;
  }
  const ratings: SuggestionRating[] = [];
  for (const rating of value.ratings) {
    if (
      !hasExactKeys(rating, ['suggestionId', 'value']) ||
      !isSuggestionId(rating.suggestionId) ||
      !isSuggestionFeedbackValue(rating.value) ||
      ratings.some(({ suggestionId }) => suggestionId === rating.suggestionId)
    )
      return null;
    ratings.push({ suggestionId: rating.suggestionId, value: rating.value });
  }
  if (
    Object.values(counts).reduce((total, count) => total + count, 0) !==
      ratedCards ||
    SUGGESTION_FEEDBACK_VALUES.some(
      (feedback) =>
        ratings.filter(({ value: rating }) => rating === feedback).length !==
        counts[feedback],
    )
  )
    return null;
  return { ratedCards, counts, ratings };
}

export function createSuggestionFeedbackExport(
  snapshot: SuggestionFeedbackSnapshot,
  exportedAt = new Date().toISOString(),
): SuggestionFeedbackExport {
  return {
    schema: 'meeting-copilot.suggestion-feedback.v1',
    exportedAt,
    metrics: {
      ratedCards: snapshot.ratedCards,
      counts: { ...snapshot.counts },
    },
  };
}
