import { isSpeechSegment } from '../../contracts/meeting/localTranscript';
import { TranscriptReconciler } from './TranscriptReconciler';
import type { LocalTranscriptSnapshot } from '../../contracts/meeting/localTranscript';
import type {
  AudioSource,
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../contracts/native/protocol';

/** Session ownership and channel state around a bounded, reconciled display window. */
export class LocalTranscript {
  private value: Omit<LocalTranscriptSnapshot, 'segments'> | null = null;
  private sequences = new Map<AudioSource, number>();
  private readonly speech = new TranscriptReconciler();

  start(config: TranscriptionConfig): void {
    this.clear();
    this.value = {
      failed: false,
      config: { ...config, sources: [...config.sources] },
      channels: [],
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
      this.speech.receive(event);
    } else {
      if (event.type === 'status' && event.state === 'paused')
        this.speech.discardPartials(event.source);
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
    this.speech.clear();
  }

  clear(): void {
    this.value = null;
    this.sequences.clear();
    this.speech.clear();
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
          segments: this.speech.snapshot(),
        }
      : null;
  }
}
