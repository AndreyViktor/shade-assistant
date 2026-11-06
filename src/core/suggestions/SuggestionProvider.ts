import type { SuggestionContent } from '../../contracts/meeting/suggestion';
import type { MeetingContext } from '../meeting/ContextManager';

export type SuggestionRequest = {
  context: MeetingContext;
  language: 'pt-BR' | 'en-US';
  signal: AbortSignal;
};
export type SuggestionFailure =
  | 'not-authorized'
  | 'credentials-unavailable'
  | 'invalid-request'
  | 'cancelled'
  | 'timeout'
  | 'network'
  | 'authentication'
  | 'rate-limited'
  | 'unavailable'
  | 'rejected'
  | 'refused'
  | 'incomplete'
  | 'invalid-response';
export type SuggestionResult =
  | { ok: true; suggestions: SuggestionContent[] }
  | { ok: false; code: SuggestionFailure };

/** Returns safe failures instead of transport errors. Host owns consent, budget,
 * scheduling and session invalidation; provider never publishes cards directly. */
export interface SuggestionProvider {
  generate(request: SuggestionRequest): Promise<SuggestionResult>;
}
