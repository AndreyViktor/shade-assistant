import { parseSuggestionBatch } from '../../contracts/meeting/suggestion';
import { parseMeetingResultUpdates } from '../../contracts/meeting/meetingResult';
import { hasExactKeys } from '../../contracts/validation';
import type { SuggestionResult } from '../../core/suggestions/SuggestionProvider';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSuggestionResponse(value: unknown): SuggestionResult {
  const invalid: SuggestionResult = { ok: false, code: 'invalid-response' };
  if (!isRecord(value)) return invalid;
  if (value.status === 'incomplete') return { ok: false, code: 'incomplete' };
  if (value.status !== 'completed' || !Array.isArray(value.output))
    return invalid;
  let text: string | undefined;
  for (const item of value.output) {
    if (!isRecord(item)) return invalid;
    // Reasoning models may emit metadata before the assistant message.
    if (item.type === 'reasoning') continue;
    if (
      item.type !== 'message' ||
      item.role !== 'assistant' ||
      item.status !== 'completed' ||
      !Array.isArray(item.content)
    )
      return invalid;
    for (const part of item.content) {
      if (!isRecord(part)) return invalid;
      if (part.type === 'refusal') return { ok: false, code: 'refused' };
      if (
        part.type !== 'output_text' ||
        typeof part.text !== 'string' ||
        text !== undefined
      )
        return invalid;
      text = part.text;
    }
  }
  if (text === undefined) return invalid;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!hasExactKeys(parsed, ['suggestions', 'resultUpdates'])) return invalid;
    const suggestions = parseSuggestionBatch({
      suggestions: parsed.suggestions,
    });
    const resultUpdates = parseMeetingResultUpdates(parsed.resultUpdates);
    return suggestions && resultUpdates
      ? { ok: true, suggestions, resultUpdates }
      : invalid;
  } catch {
    return invalid;
  }
}
