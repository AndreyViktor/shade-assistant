import type {
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../contracts/native/protocol';

/** One instance per session. Implementations must validate events before delivery. */
export interface TranscriptionProvider {
  /** Explicit authorization is a main-process precondition, never inferred here.
   * Resolves after every requested source is ready/listening, rejects on startup failure.
   * Aborting must stop capture and release resources, including during startup.
   */
  start(
    config: TranscriptionConfig,
    onEvent: (event: TranscriptionEvent) => void,
    signal: AbortSignal,
  ): Promise<void>;
  /** Resolves only after capture stops; no transcript callbacks until resume. */
  pause(): Promise<void>;
  /** Resumes the same session/clock/sequences; rejects unless paused. */
  resume(): Promise<void>;
  /** Idempotent, including before/during start; resolves after cleanup and final callbacks.
   * No callbacks after resolution. Transport failures reject with safe codes, not payloads.
   */
  stop(): Promise<void>;
}
