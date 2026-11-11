import { hasExactKeys } from '../validation';
import { parseSuggestions } from './suggestion';
import type { Suggestion } from './suggestion';

export type SuggestionAuthorization = { model: string; maxRequests: number };
export type SuggestionSessionSnapshot = {
  items: Suggestion[];
  remainingRequests: number;
  status: 'disabled' | 'ready' | 'exhausted' | 'unavailable';
};

export function emptySuggestionSession(): SuggestionSessionSnapshot {
  return { items: [], remainingRequests: 0, status: 'disabled' };
}

export function parseSuggestionAuthorization(
  value: unknown,
): SuggestionAuthorization | null {
  if (
    !hasExactKeys(value, ['model', 'maxRequests']) ||
    typeof value.model !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value.model) ||
    typeof value.maxRequests !== 'number' ||
    !Number.isSafeInteger(value.maxRequests) ||
    value.maxRequests < 1 ||
    value.maxRequests > 100
  )
    return null;
  return { model: value.model, maxRequests: value.maxRequests };
}

export function parseSuggestionSession(
  value: unknown,
): SuggestionSessionSnapshot | null {
  if (
    !hasExactKeys(value, ['items', 'remainingRequests', 'status']) ||
    typeof value.remainingRequests !== 'number' ||
    !Number.isSafeInteger(value.remainingRequests) ||
    value.remainingRequests < 0 ||
    value.remainingRequests > 100 ||
    (value.status !== 'disabled' &&
      value.status !== 'ready' &&
      value.status !== 'exhausted' &&
      value.status !== 'unavailable')
  )
    return null;
  const items = parseSuggestions(value.items);
  return items
    ? {
        items,
        remainingRequests: value.remainingRequests,
        status: value.status,
      }
    : null;
}
