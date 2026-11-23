import {
  emptySuggestionFeedback,
  SUGGESTION_FEEDBACK_VALUES,
} from '../../contracts/meeting/suggestionFeedback';
import type {
  SuggestionFeedbackSnapshot,
  SuggestionFeedbackValue,
} from '../../contracts/meeting/suggestionFeedback';

/** Session-local feedback. IDs never leave the session snapshot or enter exports. */
export class SuggestionFeedbackStore {
  private readonly ratings = new Map<string, SuggestionFeedbackValue>();

  rate(suggestionId: string, value: SuggestionFeedbackValue): void {
    this.ratings.set(suggestionId, value);
  }

  clear(): void {
    this.ratings.clear();
  }

  snapshot(): SuggestionFeedbackSnapshot {
    const snapshot = emptySuggestionFeedback();
    snapshot.ratings = [...this.ratings].map(([suggestionId, value]) => ({
      suggestionId,
      value,
    }));
    snapshot.ratedCards = snapshot.ratings.length;
    for (const feedback of SUGGESTION_FEEDBACK_VALUES)
      snapshot.counts[feedback] = snapshot.ratings.filter(
        ({ value }) => value === feedback,
      ).length;
    return snapshot;
  }
}
