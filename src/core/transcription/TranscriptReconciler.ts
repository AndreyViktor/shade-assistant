import { MAX_VISIBLE_SEGMENTS } from '../../contracts/meeting/localTranscript';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';
import type { AudioSource } from '../../contracts/native/protocol';

// Keep both sources behind the grouped display, with a fixed memory ceiling.
export const MAX_RETAINED_SEGMENTS = MAX_VISIBLE_SEGMENTS * 2;
const REVISION_TOLERANCE_MS = 250;
type Position = Pick<SpeechSegment, 'startMs' | 'endMs' | 'source' | 'seq'>;

function compare(a: Position, b: Position): number {
  return (
    a.startMs - b.startMs ||
    a.endMs - b.endMs ||
    (a.source === b.source ? 0 : a.source === 'mic' ? -1 : 1) ||
    a.seq - b.seq
  );
}

function overlap(a: SpeechSegment, b: SpeechSegment): number {
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

/** A textual hint, never acoustic echo cancellation or speaker identification. */
function possibleEcho(a: SpeechSegment, b: SpeechSegment): boolean {
  if (
    a.source === b.source ||
    a.locale !== b.locale ||
    a.type !== 'final' ||
    b.type !== 'final' ||
    Math.abs(a.startMs - b.startMs) > REVISION_TOLERANCE_MS ||
    Math.abs(a.endMs - b.endMs) > REVISION_TOLERANCE_MS ||
    overlap(a, b) <= 0 ||
    overlap(a, b) < 0.8 * Math.max(a.endMs - a.startMs, b.endMs - b.startMs)
  )
    return false;
  const text = normalizedText(a.text);
  return (
    text.length >= 20 &&
    text.split(' ').length >= 4 &&
    text === normalizedText(b.text)
  );
}

/** Receives one session/locale's validated speech in transport order. */
export class TranscriptReconciler {
  private segments: SpeechSegment[] = [];
  private evictedThrough: Position | null = null;

  receive(event: SpeechSegment): void {
    if (this.evictedThrough && compare(event, this.evictedThrough) <= 0) return;
    const finals = this.segments.filter(
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
      return;
    this.segments = this.segments.filter(
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
    this.segments.push({ ...event });
    this.segments.sort(compare);
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
    return this.segments
      .filter(
        (segment) =>
          segment.source !== 'mic' ||
          !this.segments.some((other) => possibleEcho(segment, other)),
      )
      .slice(-MAX_VISIBLE_SEGMENTS)
      .map((segment) => ({ ...segment }));
  }

  clear(): void {
    this.segments = [];
    this.evictedThrough = null;
  }
}
