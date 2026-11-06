import {
  isSpeechSegment,
  MAX_VISIBLE_SEGMENTS,
} from '../../contracts/meeting/localTranscript';
import type { LocalTranscriptSnapshot } from '../../contracts/meeting/localTranscript';
import type {
  AudioSource,
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../contracts/native/protocol';

/** Small display window only. Cross-source ordering/echo reconciliation belongs to T018. */
export class LocalTranscript {
  private value: LocalTranscriptSnapshot | null = null;
  private sequences = new Map<AudioSource, number>();

  start(config: TranscriptionConfig): void {
    this.clear();
    this.value = {
      failed: false,
      config: { ...config, sources: [...config.sources] },
      channels: [],
      segments: [],
    };
  }

  receive(event: TranscriptionEvent, acceptSpeech: boolean): boolean {
    const value = this.value;
    if (
      !value ||
      event.sessionId !== value.config.sessionId ||
      event.locale !== value.config.locale ||
      !value.config.sources.includes(event.source) ||
      event.seq <= (this.sequences.get(event.source) ?? 0)
    )
      return false;
    this.sequences.set(event.source, event.seq);
    if (isSpeechSegment(event)) {
      if (!acceptSpeech) return false;
      const index = value.segments.findIndex(
        (segment) =>
          segment.source === event.source &&
          segment.segmentId === event.segmentId,
      );
      if (index >= 0) {
        // A finalized segment must never revert to a provisional hypothesis.
        if (value.segments[index]?.type === 'final') return false;
        value.segments[index] = { ...event };
      } else value.segments.push({ ...event });
      value.segments = value.segments.slice(-MAX_VISIBLE_SEGMENTS);
    } else {
      value.channels = [
        ...value.channels.filter((channel) => channel.source !== event.source),
        { ...event },
      ];
    }
    return true;
  }

  fail(): void {
    if (this.value) this.value.failed = true;
    this.discardSpeech();
  }

  discardSpeech(): void {
    if (this.value) this.value.segments = [];
  }

  clear(): void {
    this.value = null;
    this.sequences.clear();
  }

  snapshot(): LocalTranscriptSnapshot | null {
    return this.value
      ? {
          failed: this.value.failed,
          config: {
            ...this.value.config,
            sources: [...this.value.config.sources],
          },
          channels: this.value.channels.map((event) => ({ ...event })),
          segments: this.value.segments.map((event) => ({ ...event })),
        }
      : null;
  }
}
