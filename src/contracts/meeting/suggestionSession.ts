import { hasExactKeys } from '../validation';
import {
  parseSuggestions,
  SUGGESTION_SESSION_CARD_LIMIT,
  SUGGESTION_SESSION_REQUEST_LIMIT,
} from './suggestion';
import type { Suggestion } from './suggestion';
import { parseSuggestionDiagnostics } from './suggestionDiagnostics';
import type { SuggestionDiagnostics } from './suggestionDiagnostics';

export const USER_CONTEXT_LIMIT = 2000;

/** UTF-16 units, matching textarea maxLength. Empty input is omitted on the wire. */
export function parseUserContext(value: unknown): string | null {
  return typeof value === 'string' && value.length <= USER_CONTEXT_LIMIT
    ? value.trim()
    : null;
}

export type SuggestionAuthorization = {
  model: string;
  maxRequests: number;
  userContext?: string;
};
export type SuggestionSessionSnapshot = {
  items: Suggestion[];
  remainingRequests: number;
  status: 'disabled' | 'ready' | 'exhausted' | 'unavailable';
  diagnostics: SuggestionDiagnostics | null;
};

export function emptySuggestionSession(): SuggestionSessionSnapshot {
  return {
    items: [],
    remainingRequests: 0,
    status: 'disabled',
    diagnostics: null,
  };
}

export function parseSuggestionAuthorization(
  value: unknown,
): SuggestionAuthorization | null {
  if (
    (!hasExactKeys(value, ['model', 'maxRequests']) &&
      !hasExactKeys(value, ['model', 'maxRequests', 'userContext'])) ||
    typeof value.model !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value.model) ||
    typeof value.maxRequests !== 'number' ||
    !Number.isSafeInteger(value.maxRequests) ||
    value.maxRequests < 1 ||
    value.maxRequests > SUGGESTION_SESSION_REQUEST_LIMIT
  )
    return null;
  const userContext =
    'userContext' in value ? parseUserContext(value.userContext) : '';
  if (userContext === null) return null;
  return {
    model: value.model,
    maxRequests: value.maxRequests,
    ...(userContext ? { userContext } : {}),
  };
}

export function parseSuggestionSession(
  value: unknown,
): SuggestionSessionSnapshot | null {
  if (
    !hasExactKeys(value, [
      'items',
      'remainingRequests',
      'status',
      'diagnostics',
    ]) ||
    typeof value.remainingRequests !== 'number' ||
    !Number.isSafeInteger(value.remainingRequests) ||
    value.remainingRequests < 0 ||
    value.remainingRequests > SUGGESTION_SESSION_REQUEST_LIMIT ||
    (value.status !== 'disabled' &&
      value.status !== 'ready' &&
      value.status !== 'exhausted' &&
      value.status !== 'unavailable')
  )
    return null;
  const items = parseSuggestions(value.items, SUGGESTION_SESSION_CARD_LIMIT);
  if (!items || items.some((card) => card.expiresAt !== null)) return null;
  if (
    value.status === 'disabled' &&
    (items.length !== 0 || value.remainingRequests !== 0)
  )
    return null;
  const diagnostics = parseSuggestionDiagnostics(value.diagnostics);
  if (value.status === 'disabled' ? value.diagnostics !== null : !diagnostics)
    return null;
  return {
    items,
    remainingRequests: value.remainingRequests,
    status: value.status,
    diagnostics,
  };
}
