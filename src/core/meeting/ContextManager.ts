import { isSpeechSegment } from '../../contracts/meeting/localTranscript';
import {
  isProtocolTime,
  parseNativeCommand,
  parseTranscriptionEvent,
} from '../../contracts/native/protocol';
import { reconcileSpeech } from '../transcription/TranscriptReconciler';
import { estimateContextTokens, summarizeFinal } from './contextSummary';
import type { ContextExcerpt } from './contextSummary';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';
import type {
  AudioSource,
  TranscriptionConfig,
} from '../../contracts/native/protocol';

export type ContextLimits = {
  windowMs: number;
  maxSegments: number;
  maxEstimatedTokens: number;
  maxSummaryEstimatedTokens: number;
  maxSummaryEntries: number;
  maxExcerptCodePoints: number;
};
export const DEFAULT_CONTEXT_LIMITS: Readonly<ContextLimits> = Object.freeze({
  windowMs: 240_000,
  maxSegments: 128,
  maxEstimatedTokens: 12_000,
  maxSummaryEstimatedTokens: 2_000,
  maxSummaryEntries: 12,
  maxExcerptCodePoints: 240,
});
export type MeetingContext = {
  recent: SpeechSegment[];
  /** Lossy extractive history, only from finalized speech. Sources are not people. */
  summary: ContextExcerpt[];
};
export type ContextSnapshot = MeetingContext & { estimatedTokens: number };

/** In-memory context only. The caller owns capture, authorization and transport.
 * Supply the session's elapsed clock via advanceTo during silence; no wall clock/timers.
 * Wire to real session lifecycle in T024, not through the renderer's display window.
 */
export class ContextManager {
  private readonly limits: ContextLimits;
  private config: TranscriptionConfig | null = null;
  private sequences = new Map<AudioSource, number>();
  private paused = new Set<AudioSource>();
  private recent: SpeechSegment[] = [];
  private summary: ContextExcerpt[] = [];
  private nowMs = 0;
  private closedThroughMs = -1;

  constructor(limits: Partial<ContextLimits> = {}) {
    this.limits = { ...DEFAULT_CONTEXT_LIMITS, ...limits };
    for (const key of Object.keys(
      DEFAULT_CONTEXT_LIMITS,
    ) as (keyof ContextLimits)[]) {
      const value = this.limits[key];
      if (
        !Number.isSafeInteger(value) ||
        value <= 0 ||
        value > DEFAULT_CONTEXT_LIMITS[key]
      )
        throw new Error('Invalid context limits');
    }
    if (
      this.limits.maxEstimatedTokens < 512 ||
      this.limits.maxSummaryEstimatedTokens < 256 ||
      this.limits.maxSummaryEstimatedTokens >= this.limits.maxEstimatedTokens
    )
      throw new Error('Invalid context limits');
  }

  start(config: TranscriptionConfig): void {
    this.clear();
    const command = parseNativeCommand({
      ...config,
      version: 1,
      type: 'start',
    });
    if (command.type !== 'start') throw new Error('Invalid context session');
    this.config = {
      sessionId: command.sessionId,
      sources: command.sources,
      locale: command.locale,
    };
  }

  /** Invalid payloads throw safe protocol errors before any state change. */
  receive(input: unknown): boolean {
    const event = parseTranscriptionEvent(input);
    if (
      !this.config ||
      event.sessionId !== this.config.sessionId ||
      event.locale !== this.config.locale ||
      !this.config.sources.includes(event.source) ||
      event.seq <= (this.sequences.get(event.source) ?? 0)
    )
      return false;
    this.sequences.set(event.source, event.seq);
    if (event.type === 'error' || event.type === 'stopped') {
      this.clear();
      return true;
    }
    this.advanceTo(event.timestampMs);
    if (event.type === 'status') {
      if (event.state === 'paused') {
        this.paused.add(event.source);
        this.recent = this.recent.filter(
          (segment) =>
            segment.source !== event.source || segment.type === 'final',
        );
      } else this.paused.delete(event.source);
    }
    if (!isSpeechSegment(event)) return true;
    if (
      this.paused.has(event.source) ||
      event.startMs < this.nowMs - this.limits.windowMs ||
      event.startMs <= this.closedThroughMs
    )
      return false;
    this.recent = reconcileSpeech(this.recent, event);
    this.trim();
    return true;
  }

  advanceTo(elapsedMs: number): void {
    if (!isProtocolTime(elapsedMs)) throw new Error('Invalid context time');
    if (!this.config) return;
    this.nowMs = Math.max(this.nowMs, elapsedMs);
    this.trim();
  }

  snapshot(): ContextSnapshot | null {
    if (!this.config) return null;
    const context: MeetingContext = {
      recent: this.recent.map((segment) => ({ ...segment })),
      summary: this.summary.map((excerpt) => ({ ...excerpt })),
    };
    return { ...context, estimatedTokens: estimateContextTokens(context) };
  }

  clear(): void {
    this.config = null;
    this.recent = [];
    this.summary = [];
    this.sequences.clear();
    this.paused.clear();
    this.nowMs = 0;
    this.closedThroughMs = -1;
  }

  private trim(): void {
    while (
      this.recent.length > this.limits.maxSegments ||
      (this.recent[0] &&
        this.recent[0].startMs < this.nowMs - this.limits.windowMs)
    )
      this.archiveOldest();
    // Recent verbatim speech takes priority over the lossy summary.
    while (
      estimateContextTokens({ recent: this.recent, summary: this.summary }) >
      this.limits.maxEstimatedTokens
    ) {
      if (this.summary.length > 0) this.summary.shift();
      else this.archiveOldest();
    }
  }

  private archiveOldest(): void {
    const oldest = this.recent[0];
    if (!oldest) return;
    this.closedThroughMs = Math.max(this.closedThroughMs, oldest.startMs);
    // Close a whole start-time group, so tied sources cannot revive evicted history.
    while (this.recent[0] && this.recent[0].startMs <= this.closedThroughMs) {
      const segment = this.recent.shift();
      if (!segment) break;
      const excerpt = summarizeFinal(segment, this.limits.maxExcerptCodePoints);
      if (excerpt) this.summary.push(excerpt);
    }
    while (
      this.summary.length > this.limits.maxSummaryEntries ||
      estimateContextTokens(this.summary) >
        this.limits.maxSummaryEstimatedTokens
    )
      this.summary.shift();
  }
}
