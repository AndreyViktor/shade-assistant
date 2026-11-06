import { parseSuggestionBatch } from '../../contracts/meeting/suggestion';
import type { SuggestionContent } from '../../contracts/meeting/suggestion';
import type {
  SuggestionProvider,
  SuggestionRequest,
  SuggestionResult,
} from '../../core/suggestions/SuggestionProvider';

/** Explicit synthetic output, no network, credentials or trigger heuristics. */
export class MockSuggestionProvider implements SuggestionProvider {
  private readonly suggestions: SuggestionContent[] | null;
  constructor(batch: unknown = { suggestions: [] }) {
    this.suggestions = parseSuggestionBatch(batch);
  }

  generate({ signal }: SuggestionRequest): Promise<SuggestionResult> {
    if (signal.aborted)
      return Promise.resolve({ ok: false, code: 'cancelled' });
    return Promise.resolve(
      this.suggestions
        ? {
            ok: true,
            suggestions: this.suggestions.map((content) => ({ ...content })),
          }
        : { ok: false, code: 'invalid-response' },
    );
  }
}
