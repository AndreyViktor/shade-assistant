import { parseSuggestionSession } from '../meeting/suggestionSession';
import type { SuggestionSessionSnapshot } from '../meeting/suggestionSession';
import { parseLocalTranscript } from '../meeting/localTranscript';
import type { LocalTranscriptSnapshot } from '../meeting/localTranscript';
import { isSuggestionId } from '../meeting/suggestion';
import { parseDemoSnapshot } from '../meeting/demo';
import type { DemoSnapshot } from '../meeting/demo';
import { hasExactKeys } from '../validation';
import { parseSessionSnapshot, parseSessionStart } from '../meeting/session';
import type { SessionSnapshot, SessionStart } from '../meeting/session';
import { parseStatusResult } from './appStatus';
import type { IpcErrorCode } from './appStatus';
import { parseMeetingResults } from '../meeting/meetingResult';
import type { MeetingResultsSnapshot } from '../meeting/meetingResult';
import { isSuggestionFeedbackValue } from '../meeting/suggestionFeedback';
import type { SuggestionFeedbackValue } from '../meeting/suggestionFeedback';

export const SESSION_CHANNEL = 'meeting-copilot:session';
export const SESSION_IPC_VERSION = 11;
export type SessionRequest =
  | {
      version: typeof SESSION_IPC_VERSION;
      action: 'read' | 'pause' | 'resume' | 'stop' | 'revoke-suggestions';
    }
  | {
      version: typeof SESSION_IPC_VERSION;
      action: 'start';
      options: SessionStart;
    }
  | {
      version: typeof SESSION_IPC_VERSION;
      action: 'dismiss-suggestion';
      id: string;
    }
  | {
      version: typeof SESSION_IPC_VERSION;
      action: 'rate-suggestion';
      id: string;
      feedback: SuggestionFeedbackValue;
    }
  | {
      version: typeof SESSION_IPC_VERSION;
      action: 'clear-suggestion-feedback' | 'export-suggestion-feedback';
    };
export type SessionResult =
  | {
      version: typeof SESSION_IPC_VERSION;
      ok: true;
      session: SessionSnapshot;
      demo: DemoSnapshot;
      local: LocalTranscriptSnapshot | null;
      suggestions: SuggestionSessionSnapshot;
      results: MeetingResultsSnapshot;
    }
  | {
      version: typeof SESSION_IPC_VERSION;
      ok: false;
      code: IpcErrorCode;
    };

export function parseSessionRequest(value: unknown): SessionRequest | null {
  if (
    hasExactKeys(value, ['version', 'action']) &&
    value.version === SESSION_IPC_VERSION &&
    (value.action === 'read' ||
      value.action === 'pause' ||
      value.action === 'resume' ||
      value.action === 'stop' ||
      value.action === 'revoke-suggestions' ||
      value.action === 'clear-suggestion-feedback' ||
      value.action === 'export-suggestion-feedback')
  ) {
    return { version: SESSION_IPC_VERSION, action: value.action };
  }
  if (
    hasExactKeys(value, ['version', 'action', 'options']) &&
    value.version === SESSION_IPC_VERSION &&
    value.action === 'start'
  ) {
    const options = parseSessionStart(value.options);
    if (options)
      return { version: SESSION_IPC_VERSION, action: 'start', options };
  }
  if (
    hasExactKeys(value, ['version', 'action', 'id']) &&
    value.version === SESSION_IPC_VERSION &&
    value.action === 'dismiss-suggestion' &&
    isSuggestionId(value.id)
  ) {
    return {
      version: SESSION_IPC_VERSION,
      action: 'dismiss-suggestion',
      id: value.id,
    };
  }
  if (
    hasExactKeys(value, ['version', 'action', 'id', 'feedback']) &&
    value.version === SESSION_IPC_VERSION &&
    value.action === 'rate-suggestion' &&
    isSuggestionId(value.id) &&
    isSuggestionFeedbackValue(value.feedback)
  ) {
    return {
      version: SESSION_IPC_VERSION,
      action: 'rate-suggestion',
      id: value.id,
      feedback: value.feedback,
    };
  }
  return null;
}

export function parseSessionResult(value: unknown): SessionResult {
  if (
    hasExactKeys(value, [
      'version',
      'ok',
      'session',
      'demo',
      'local',
      'suggestions',
      'results',
    ]) &&
    value.version === SESSION_IPC_VERSION &&
    value.ok === true
  ) {
    const session = parseSessionSnapshot(value.session);
    const demo = parseDemoSnapshot(value.demo);
    const suggestions = parseSuggestionSession(value.suggestions);
    const results = parseMeetingResults(value.results);
    try {
      const local = parseLocalTranscript(value.local);
      if (
        session &&
        demo &&
        suggestions &&
        results &&
        (suggestions.status !== 'disabled' || results.items.length === 0) &&
        (session.mode === 'apple-local' ||
          (local === null &&
            suggestions.status === 'disabled' &&
            suggestions.items.length === 0 &&
            suggestions.remainingRequests === 0))
      )
        return {
          version: SESSION_IPC_VERSION,
          ok: true,
          session,
          demo,
          local,
          suggestions,
          results,
        };
    } catch {
      return {
        version: SESSION_IPC_VERSION,
        ok: false,
        code: 'INVALID_RESPONSE',
      };
    }
  }
  const failure = parseStatusResult(
    hasExactKeys(value, ['version', 'ok', 'code']) &&
      value.version === SESSION_IPC_VERSION
      ? { ...value, version: 1 }
      : null,
  );
  return failure.ok
    ? {
        version: SESSION_IPC_VERSION,
        ok: false,
        code: 'INVALID_RESPONSE',
      }
    : { ...failure, version: SESSION_IPC_VERSION };
}
