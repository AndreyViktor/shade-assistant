import { MAX_VISIBLE_SEGMENTS } from '../../contracts/meeting/localTranscript';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';
import type { AudioSource } from '../../contracts/native/protocol';

// Keep both sources behind the grouped display, with a fixed memory ceiling.
export const MAX_RETAINED_SEGMENTS = MAX_VISIBLE_SEGMENTS * 2;
const REVISION_TOLERANCE_MS = 250;
const ECHO_MAX_SYSTEM_SEGMENTS = 4;
const ECHO_MAX_SYSTEM_GAP_MS = 1_500;
const ECHO_MIN_MIC_OVERLAP_RATIO = 0.6;
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

function orderedMatchingWordCount(a: string[], b: string[]): number {
  const previous = new Array<number>(b.length + 1).fill(0);
  for (const left of a) {
    let diagonal = 0;
    for (let index = 1; index <= b.length; index++) {
      const above = previous[index] ?? 0;
      previous[index] =
        left === b[index - 1]
          ? diagonal + 1
          : Math.max(above, previous[index - 1] ?? 0);
      diagonal = above;
    }
  }
  return previous[b.length] ?? 0;
}

/** A conservative textual hint, never acoustic echo cancellation or speaker identification. */
function possibleEcho(mic: EchoCandidate, system: EchoCandidate): boolean {
  const micDuration = mic.endMs - mic.startMs;
  if (
    mic.source !== 'mic' ||
    system.source !== 'system' ||
    mic.locale !== system.locale ||
    micDuration <= 0 ||
    overlap(mic, system) < ECHO_MIN_MIC_OVERLAP_RATIO * micDuration
  )
    return false;
  const micText = normalizedText(mic.text);
  const systemText = normalizedText(system.text);
  const micWords = micText.split(' ').filter(Boolean);
  const systemWords = systemText.split(' ').filter(Boolean);
  if (
    micText.length < 20 ||
    systemText.length < 20 ||
    micWords.length < ECHO_MIN_WORDS ||
    systemWords.length < ECHO_MIN_WORDS
  )
    return false;
  const matched = orderedMatchingWordCount(micWords, systemWords);
  return (
    matched >= ECHO_MIN_MATCHED_WORDS &&
    matched / micWords.length >= ECHO_MIN_WORD_SIMILARITY
  );
}

function systemEchoWindows(
  finals: readonly EchoCandidate[],
  mic: EchoCandidate,
): EchoCandidate[] {
  const systems = finals
    .filter(
      (segment) =>
        segment.source === 'system' &&
        segment.locale === mic.locale &&
        overlap(segment, mic) > 0,
    )
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const windows: EchoCandidate[] = [];
  for (let start = 0; start < systems.length; start++) {
    const first = systems[start];
    if (!first) continue;
    let endMs = first.endMs;
    let text = '';
    for (
      let end = start;
      end < Math.min(systems.length, start + ECHO_MAX_SYSTEM_SEGMENTS);
      end++
    ) {
      const segment = systems[end];
      if (!segment || segment.locale !== first.locale) break;
      if (end > start && segment.startMs - endMs > ECHO_MAX_SYSTEM_GAP_MS)
        break;
      endMs = Math.max(endMs, segment.endMs);
      text = `${text} ${segment.text}`.trim();
      windows.push({
        source: 'system',
        locale: first.locale,
        startMs: first.startMs,
        endMs,
        text,
      });
    }
  }
  return windows;
}

/** Keeps system audio when a final from each source is probably the same playback. */
export function suppressPossibleEchoes<T extends EchoCandidate>(
  finals: readonly T[],
): T[] {
  return finals.filter(
    (segment) =>
      segment.source !== 'mic' ||
      !systemEchoWindows(finals, segment).some((window) =>
        possibleEcho(segment, window),
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
