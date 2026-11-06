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
export const SUGGESTION_TITLE_LIMIT = 80;
export const SUGGESTION_BODY_LIMIT = 300;
export const SUGGESTION_BATCH_LIMIT = 2;

export function parseSuggestionContent(
  value: unknown,
): SuggestionContent | null {
  if (
    !hasExactKeys(value, ['category', 'title', 'body', 'groundedIn']) ||
    !SUGGESTION_CATEGORIES.some((category) => category === value.category) ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    value.title.length > SUGGESTION_TITLE_LIMIT ||
    typeof value.body !== 'string' ||
    !value.body.trim() ||
    value.body.length > SUGGESTION_BODY_LIMIT ||
    (value.groundedIn !== 'meeting' && value.groundedIn !== 'inference')
  )
    return null;
  return {
    category: value.category as SuggestionCategory,
    title: value.title,
    body: value.body,
    groundedIn: value.groundedIn,
  };
}

/** Model output has no authority over IDs or expiry; those remain local. */
export function parseSuggestionBatch(
  value: unknown,
): SuggestionContent[] | null {
  if (
    !hasExactKeys(value, ['suggestions']) ||
    !Array.isArray(value.suggestions) ||
    value.suggestions.length > SUGGESTION_BATCH_LIMIT
  )
    return null;
  const result: SuggestionContent[] = [];
  for (const item of value.suggestions) {
    const content = parseSuggestionContent(item);
    if (!content) return null;
    result.push(content);
  }
  return result;
}

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
    typeof value.expiresAt !== 'number' ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt < 0
  )
    return null;
  const content = parseSuggestionContent({
    category: value.category,
    title: value.title,
    body: value.body,
    groundedIn: value.groundedIn,
  });
  if (!content) return null;
  return {
    ...content,
    id: value.id,
    expiresAt: value.expiresAt,
  };
}

export function parseSuggestions(value: unknown): Suggestion[] | null {
  if (!Array.isArray(value) || value.length > SUGGESTION_BATCH_LIMIT)
    return null;
  const result: Suggestion[] = [];
  for (const item of value) {
    const suggestion = parseSuggestion(item);
    if (!suggestion || result.some(({ id }) => id === suggestion.id))
      return null;
    result.push(suggestion);
  }
  return result;
}
