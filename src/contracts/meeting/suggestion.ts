import { hasExactKeys } from '../validation';

export const SUGGESTION_CATEGORIES = [
  'answer',
  'question',
  'warning',
  'action',
] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];
export type SuggestionContent = {
  category: SuggestionCategory;
  title: string;
  body: string;
  groundedIn: 'meeting' | 'inference';
};
export type Suggestion = SuggestionContent & { id: string; expiresAt: number };

export function isSuggestionId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
}

export function parseSuggestion(value: unknown): Suggestion | null {
  if (
    !hasExactKeys(value, [
      'id',
      'category',
      'title',
      'body',
      'groundedIn',
      'expiresAt',
    ]) ||
    !isSuggestionId(value.id) ||
    !SUGGESTION_CATEGORIES.some((category) => category === value.category) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > 80 ||
    typeof value.body !== 'string' ||
    !value.body.trim() ||
    value.body.length > 300 ||
    (value.groundedIn !== 'meeting' && value.groundedIn !== 'inference') ||
    typeof value.expiresAt !== 'number' ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt < 0
  )
    return null;
  return {
    id: value.id,
    category: value.category as SuggestionCategory,
    title: value.title,
    body: value.body,
    groundedIn: value.groundedIn,
    expiresAt: value.expiresAt,
  };
}

export function parseSuggestions(value: unknown): Suggestion[] | null {
  if (!Array.isArray(value) || value.length > 2) return null;
  const result: Suggestion[] = [];
  for (const item of value) {
    const suggestion = parseSuggestion(item);
    if (!suggestion || result.some(({ id }) => id === suggestion.id))
      return null;
    result.push(suggestion);
  }
  return result;
}
