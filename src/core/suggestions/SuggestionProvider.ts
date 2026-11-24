import type { SuggestionContent } from '../../contracts/meeting/suggestion';
import type { MeetingContext } from '../meeting/ContextManager';
import type { SuggestionFailure } from '../../contracts/meeting/suggestionDiagnostics';
import type {
  MeetingResultItem,
  MeetingResultUpdate,
} from '../../contracts/meeting/meetingResult';
import type { FocusedMeetingProfileId } from '../../contracts/meeting/meetingProfile';
export type { SuggestionFailure } from '../../contracts/meeting/suggestionDiagnostics';

export type SuggestionRequest = {
  context: MeetingContext;
  existingResults?: MeetingResultItem[];
  userContext?: string;
  meetingProfile?: FocusedMeetingProfileId;
  videoNewSegmentIds?: string[];
  language: 'pt-BR' | 'en-US';
  signal: AbortSignal;
  onDispatch?: (body: string) => void;
  onHttpResponse?: (status: number) => void;
};
export type SuggestionResult =
  | {
      ok: true;
      suggestions: SuggestionContent[];
      resultUpdates?: MeetingResultUpdate[];
    }
  | { ok: false; code: SuggestionFailure };

/** Returns safe failures instead of transport errors. Host owns consent, budget,
 * scheduling and session invalidation; provider never publishes cards directly. */
export interface SuggestionProvider {
  generate(request: SuggestionRequest): Promise<SuggestionResult>;
}
