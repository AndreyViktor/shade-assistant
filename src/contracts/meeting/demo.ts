import { parseSuggestions } from './suggestion';
import type { Suggestion } from './suggestion';
import { hasExactKeys } from '../validation';

// Synthetic DEMO data only; this is not the native STT protocol (T012).
export type DemoTranscript = {
  sequence: number;
  source: 'mic' | 'system';
  locale: 'pt-BR';
  text: string;
};
export type DemoSnapshot = {
  transcript: DemoTranscript | null;
  suggestions: Suggestion[];
  completed: boolean;
};

export function emptyDemo(): DemoSnapshot {
  return { transcript: null, suggestions: [], completed: false };
}

function isSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isText(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 500
  );
}

export function parseDemoSnapshot(value: unknown): DemoSnapshot | null {
  if (
    !hasExactKeys(value, ['transcript', 'suggestions', 'completed']) ||
    typeof value.completed !== 'boolean'
  )
    return null;
  const transcript = value.transcript;
  const suggestions = parseSuggestions(value.suggestions);
  if (!suggestions) return null;
  let parsedTranscript: DemoTranscript | null = null;
  if (transcript !== null) {
    if (
      !hasExactKeys(transcript, ['sequence', 'source', 'locale', 'text']) ||
      !isSequence(transcript.sequence) ||
      (transcript.source !== 'mic' && transcript.source !== 'system') ||
      transcript.locale !== 'pt-BR' ||
      !isText(transcript.text)
    )
      return null;
    parsedTranscript = {
      sequence: transcript.sequence,
      source: transcript.source,
      locale: transcript.locale,
      text: transcript.text,
    };
  }
  return {
    transcript: parsedTranscript,
    suggestions,
    completed: value.completed,
  };
}
