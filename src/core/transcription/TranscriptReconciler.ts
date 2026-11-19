import { MAX_VISIBLE_SEGMENTS } from '../../contracts/meeting/localTranscript';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';
import type { AudioSource } from '../../contracts/native/protocol';

// Keep both sources behind the grouped display, with a fixed memory ceiling.
export const MAX_RETAINED_SEGMENTS = MAX_VISIBLE_SEGMENTS * 2;
const REVISION_TOLERANCE_MS = 250;
const ECHO_BOUNDARY_TOLERANCE_MS = 1_500;
const ECHO_MIN_OVERLAP_RATIO = 0.6;
const ECHO_MIN_WORDS = 4;
const ECHO_MIN_MATCHED_WORDS = 4;
const ECHO_MIN_WORD_SIMILARITY = 0.7;
export type SpeechPosition = Pick<
  SpeechSegment,
  'startMs' | 'endMs' | 'source' | 'seq'
>;
type EchoCandidate = Pick<
  SpeechSegment,
  'source' | 'locale' | 'startMs' | 'endMs' | 'text'
>;

export function compareSpeech(a: SpeechPosition, b: SpeechPosition): number {
  return (
    a.startMs - b.startMs ||
    a.endMs - b.endMs ||
    (a.source === b.source ? 0 : a.source === 'mic' ? -1 : 1) ||
    a.seq - b.seq
  );
}

function overlap(a: EchoCandidate, b: EchoCandidate): number {
  return Math.max(
    0,
    Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs),
  );
}

function revises(a: SpeechSegment, b: SpeechSegment): boolean {
  if (a.segmentId === b.segmentId) return true;
  const shared = overlap(a, b);
  // Exact zero-length ranges are permitted by the native protocol.
  if (a.startMs === b.startMs && a.endMs === b.endMs) return true;
  return (
    shared > 0 &&
    Math.abs(a.startMs - b.startMs) <= REVISION_TOLERANCE_MS &&
    shared >= 0.8 * Math.min(a.endMs - a.startMs, b.endMs - b.startMs)
  );
}

function normalizedText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\s]+/gu, ' ')
    .trim();
}

function matchingWordCount(a: string[], b: string[]): number {
  const available = new Map<string, number>();
  for (const word of b) available.set(word, (available.get(word) ?? 0) + 1);
  let matched = 0;
  for (const word of a) {
    const count = available.get(word) ?? 0;
    if (count === 0) continue;
    matched += 1;
    if (count === 1) available.delete(word);
    else available.set(word, count - 1);
  }
  return matched;
}

/** A conservative textual hint, never acoustic echo cancellation or speaker identification. */
function possibleEcho(a: EchoCandidate, b: EchoCandidate): boolean {
  if (
    a.source === b.source ||
    a.locale !== b.locale ||
    Math.abs(a.startMs - b.startMs) > ECHO_BOUNDARY_TOLERANCE_MS ||
    Math.abs(a.endMs - b.endMs) > ECHO_BOUNDARY_TOLERANCE_MS ||
    overlap(a, b) <= 0 ||
    overlap(a, b) <
      ECHO_MIN_OVERLAP_RATIO *
        Math.max(a.endMs - a.startMs, b.endMs - b.startMs)
  )
    return false;
  const left = normalizedText(a.text);
  const right = normalizedText(b.text);
  const leftWords = left.split(' ').filter(Boolean);
  const rightWords = right.split(' ').filter(Boolean);
  if (
    left.length < 20 ||
    right.length < 20 ||
    Math.min(leftWords.length, rightWords.length) < ECHO_MIN_WORDS
  )
    return false;
  const matched = matchingWordCount(leftWords, rightWords);
  return (
    matched >= ECHO_MIN_MATCHED_WORDS &&
    matched / Math.max(leftWords.length, rightWords.length) >=
      ECHO_MIN_WORD_SIMILARITY
  );
}

/** Keeps system audio when a final from each source is probably the same playback. */
export function suppressPossibleEchoes<T extends EchoCandidate>(
  finals: readonly T[],
): T[] {
  return finals.filter(
    (segment) =>
      segment.source !== 'mic' ||
      !finals.some(
        (other) => other.source === 'system' && possibleEcho(segment, other),
      ),
  );
}

/** Shared revision policy; input is validated, scoped to one session and locale. */
export function reconcileSpeech(
  segments: SpeechSegment[],
  event: SpeechSegment,
): SpeechSegment[] {
  const finals = segments.filter(
    (segment) => segment.source === event.source && segment.type === 'final',
  );
  if (
    finals.some(
      (segment) =>
        segment.segmentId === event.segmentId ||
        (event.type === 'partial' &&
          revises(segment, event) &&
          event.endMs <= segment.endMs + REVISION_TOLERANCE_MS) ||
        (event.type === 'final' &&
          segment.startMs === event.startMs &&
          segment.endMs === event.endMs &&
          normalizedText(segment.text) === normalizedText(event.text)),
    )
  )
    return segments;
  segments = segments.filter(
    (segment) =>
      segment.source !== event.source ||
      segment.type !== 'partial' ||
      !(
        revises(segment, event) ||
        (event.type === 'final' &&
          event.startMs <= segment.startMs &&
          event.endMs >= segment.endMs)
      ),
  );
  return [...segments, { ...event }].sort(compareSpeech);
}

/** Receives one session/locale's validated speech in transport order. */
export class TranscriptReconciler {
  private segments: SpeechSegment[] = [];
  private evictedThrough: SpeechPosition | null = null;

  receive(event: SpeechSegment): void {
    if (this.evictedThrough && compareSpeech(event, this.evictedThrough) <= 0)
      return;
    this.segments = reconcileSpeech(this.segments, event);
    while (this.segments.length > MAX_RETAINED_SEGMENTS) {
      const removed = this.segments.shift();
      if (removed) {
        const { startMs, endMs, source, seq } = removed;
        this.evictedThrough = { startMs, endMs, source, seq };
      }
    }
  }

  discardPartials(source: AudioSource): void {
    this.segments = this.segments.filter(
      (segment) => segment.source !== source || segment.type === 'final',
    );
  }

  snapshot(): SpeechSegment[] {
    // Prefer the original system event as the representative, regardless of arrival order.
    // Keep both originals internally so pruning/reconciliation can undo the grouping.
    const visibleFinals = new Set(
      suppressPossibleEchoes(
        this.segments.filter((segment) => segment.type === 'final'),
      ),
    );
    return this.segments
      .filter(
        (segment) => segment.type === 'partial' || visibleFinals.has(segment),
      )
      .slice(-MAX_VISIBLE_SEGMENTS)
      .map((segment) => ({ ...segment }));
  }

  clear(): void {
    this.segments = [];
    this.evictedThrough = null;
  }
}
