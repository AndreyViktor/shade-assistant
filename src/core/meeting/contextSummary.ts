import type { SpeechSegment } from '../../contracts/meeting/localTranscript';

export type ContextExcerpt = Pick<
  SpeechSegment,
  'source' | 'locale' | 'segmentId' | 'startMs' | 'endMs' | 'text'
> & { truncated: boolean };

/** Conservative, model-independent budget units, not billed/model token counts.
 * Count the serialized payload, including metadata, escapes and UTF-8 text.
 */
export function estimateContextTokens(payload: unknown): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}

/** Extract only; never turn an unfinished hypothesis into a recorded fact. */
export function summarizeFinal(
  segment: SpeechSegment,
  maxCodePoints: number,
): ContextExcerpt | null {
  if (segment.type !== 'final') return null;
  const characters = Array.from(segment.text);
  return {
    source: segment.source,
    locale: segment.locale,
    segmentId: segment.segmentId,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: characters.slice(0, maxCodePoints).join(''),
    truncated: characters.length > maxCodePoints,
  };
}
