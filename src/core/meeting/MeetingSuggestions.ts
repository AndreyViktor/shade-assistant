import { ContextManager } from './ContextManager';
import type { MeetingContext } from './ContextManager';
import { SuggestionScheduler } from '../suggestions/SuggestionScheduler';
import { TriggerEngine } from '../suggestions/TriggerEngine';
import type { Trigger } from '../suggestions/TriggerEngine';
import type {
  SuggestionAttempt,
  SuggestionDiagnostics,
} from '../../contracts/meeting/suggestionDiagnostics';
import type {
  SuggestionResult,
  SuggestionProvider,
} from '../suggestions/SuggestionProvider';
import type { MeetingSession } from './MeetingSession';
import type {
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../contracts/native/protocol';
import { emptySuggestionSession } from '../../contracts/meeting/suggestionSession';
import type {
  SuggestionAuthorization,
  SuggestionSessionSnapshot,
} from '../../contracts/meeting/suggestionSession';
import { MeetingResultStore } from './MeetingResultStore';
import type { MeetingResultsSnapshot } from '../../contracts/meeting/meetingResult';
import type { FocusedMeetingProfileId } from '../../contracts/meeting/meetingProfile';
import { SuggestionFeedbackStore } from '../suggestions/SuggestionFeedbackStore';
import type { SuggestionFeedbackValue } from '../../contracts/meeting/suggestionFeedback';
import { parseCitation } from '../../contracts/meeting/suggestion';

export type SuggestionProviderFactory = (
  authorization: SuggestionAuthorization,
  isAuthorized: () => boolean,
) => SuggestionProvider;

/** One scheduler survives restarts so a non-cooperative provider cannot overlap.
 * Budgets count attempts (including failures), never reset on pause, and are
 * consumed before credential/transport work. All context remains in memory.
 */
export class MeetingSuggestions {
  private readonly context = new ContextManager();
  private readonly results = new MeetingResultStore();
  private readonly feedback = new SuggestionFeedbackStore();
  private readonly trigger = new TriggerEngine();
  private readonly scheduler: SuggestionScheduler;
  private provider: SuggestionProvider | undefined;
  private remaining = 0;
  private language: 'pt-BR' | 'en-US' = 'pt-BR';
  private enabled = false;
  private failed = false;
  private revision = 0;
  private generation = 0;
  private signature = '';
  private elapsed = 0;
  private lastClock = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private model = '';
  private userContext = '';
  private meetingProfile: FocusedMeetingProfileId | undefined;
  private maxRequests = 0;
  private lastTrigger: Trigger = 'none';
  private hasFinal = false;
  private lastAttempt: SuggestionAttempt | null = null;
  private videoSignature = '';
  private videoCheckAt = 0;
  private readonly videoSeen = new Set<string>();

  constructor(
    private readonly session: MeetingSession,
    private readonly createProvider: SuggestionProviderFactory,
  ) {
    this.scheduler = new SuggestionScheduler(
      {
        generate: async (request) => {
          const provider = this.provider;
          if (!this.authorized() || !provider || this.remaining <= 0)
            return { ok: false, code: 'not-authorized' };
          const videoSegments =
            this.meetingProfile === 'video-fact-check'
              ? request.context.recent.filter(
                  (part) =>
                    !this.videoSeen.has(
                      JSON.stringify([part.segmentId, part.text]),
                    ),
                )
              : [];
          if (
            this.meetingProfile === 'video-fact-check' &&
            videoSegments.length === 0
          )
            return { ok: true, suggestions: [], resultUpdates: [] };
          for (const part of videoSegments)
            this.videoSeen.add(JSON.stringify([part.segmentId, part.text]));
          while (this.videoSeen.size > 2000) {
            const oldest = this.videoSeen.values().next().value;
            if (oldest === undefined) break;
            this.videoSeen.delete(oldest);
          }
          const generation = this.generation;
          this.remaining -= 1;
          const attempt: SuggestionAttempt = {
            number: this.maxRequests - this.remaining,
            startedAt: Date.now(),
            durationMs: null,
            requestBody: null,
            httpStatus: null,
            result: 'pending',
            suggestionCount: null,
          };
          this.lastAttempt = attempt;
          const current = () =>
            generation === this.generation && this.lastAttempt === attempt;
          const cancel = () => {
            if (!current()) return;
            attempt.result = 'cancelled';
            attempt.durationMs = Math.max(0, Date.now() - attempt.startedAt);
          };
          request.signal.addEventListener('abort', cancel, { once: true });
          let result: SuggestionResult;
          try {
            result = await provider.generate({
              ...request,
              language: this.language,
              ...(this.userContext ? { userContext: this.userContext } : {}),
              ...(this.meetingProfile
                ? { meetingProfile: this.meetingProfile }
                : {}),
              ...(this.meetingProfile === 'video-fact-check'
                ? {
                    videoNewSegmentIds: videoSegments.map(
                      (part) => part.segmentId,
                    ),
                  }
                : {}),
              onDispatch: (body) => {
                if (current() && !request.signal.aborted)
                  attempt.requestBody = body;
              },
              onHttpResponse: (status) => {
                if (current() && !request.signal.aborted)
                  attempt.httpStatus = status;
              },
            });
          } catch {
            result = { ok: false, code: 'unavailable' };
          } finally {
            request.signal.removeEventListener('abort', cancel);
          }
          if (current() && !request.signal.aborted) {
            this.failed = !result.ok;
            attempt.result = result.ok
              ? result.suggestions.length
                ? 'success'
                : 'empty'
              : result.code;
            attempt.suggestionCount = result.ok
              ? result.suggestions.length
              : null;
            attempt.durationMs = Math.max(0, Date.now() - attempt.startedAt);
          }
          return result;
        },
      },
      this.authorized,
      'pt-BR',
      { ttlMs: null },
      true,
      (updates, context) => this.results.apply(updates, context),
      () => this.results.snapshot().items,
    );
  }

  private authorized = (): boolean =>
    this.enabled && this.session.permits('context');

  start(
    config: TranscriptionConfig,
    authorization?: SuggestionAuthorization,
  ): void {
    this.stop();
    if (!authorization || !this.session.permits('context')) return;
    this.enabled = true;
    this.language = config.locale;
    this.remaining = authorization.maxRequests;
    this.model = authorization.model;
    this.userContext = authorization.userContext ?? '';
    this.meetingProfile = authorization.meetingProfile;
    this.scheduler.setResponseTimeout(
      this.meetingProfile === 'video-fact-check' ? 60_000 : 15_000,
    );
    this.maxRequests = authorization.maxRequests;
    const generation = this.generation;
    try {
      this.provider = this.createProvider(
        { model: authorization.model, maxRequests: authorization.maxRequests },
        () => generation === this.generation && this.authorized(),
      );
    } catch {
      this.failed = true;
      return;
    }
    this.context.start(config);
    this.lastClock = Date.now();
    if (this.meetingProfile === 'video-fact-check')
      this.videoCheckAt = this.lastClock + 20_000;
    this.resume();
  }

  receive(event: TranscriptionEvent): void {
    if (!this.authorized()) return;
    if (!this.context.receive(event)) return;
    if (event.type === 'stopped' || event.type === 'error') {
      this.scheduler.invalidate();
      return;
    }
    this.elapsed = Math.max(this.elapsed, event.timestampMs);
    this.lastClock = Date.now();
    this.publishContext(event);
  }

  requestManual(): void {
    if (!this.authorized() || this.remaining <= 0) return;
    const context = this.context.snapshot();
    if (!context) return;
    this.lastTrigger = 'manual';
    this.scheduler.submit(
      {
        recent: context.recent.filter(
          (segment) =>
            segment.type === 'final' &&
            (this.meetingProfile !== 'video-fact-check' ||
              segment.source === 'system'),
        ),
        summary: context.summary.filter(
          (segment) =>
            this.meetingProfile !== 'video-fact-check' ||
            segment.source === 'system',
        ),
      },
      this.revision,
      'manual',
    );
  }

  private publishContext(event?: TranscriptionEvent): void {
    const context = this.context.snapshot();
    if (!context) return;
    // Partial hypotheses never trigger requests or enter the provider context.
    const finalContext: MeetingContext = {
      recent: context.recent.filter(
        (segment) =>
          segment.type === 'final' &&
          (this.meetingProfile !== 'video-fact-check' ||
            segment.source === 'system'),
      ),
      summary: context.summary.filter(
        (segment) =>
          this.meetingProfile !== 'video-fact-check' ||
          segment.source === 'system',
      ),
    };
    const signature = JSON.stringify({
      recent: finalContext.recent.map(
        ({ source, locale, segmentId, startMs, endMs, text }) => ({
          source,
          locale,
          segmentId,
          startMs,
          endMs,
          text,
        }),
      ),
      summary: finalContext.summary,
    });
    if (signature === this.signature) return;
    this.signature = signature;
    this.hasFinal =
      finalContext.recent.length > 0 || finalContext.summary.length > 0;
    const trigger =
      event?.type === 'final' && this.meetingProfile !== 'video-fact-check'
        ? this.trigger.evaluate(event)
        : 'none';
    if (event?.type === 'final') this.lastTrigger = trigger;
    if (this.meetingProfile === 'video-fact-check') return;
    this.scheduler.submit(
      finalContext,
      ++this.revision,
      this.remaining > 0 ? trigger : 'none',
    );
  }

  pause(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.scheduler.stop();
    if (this.lastAttempt) this.lastAttempt.requestBody = null;
  }

  resume(): void {
    if (!this.authorized()) return;
    void this.session.run('context', (signal) => {
      this.scheduler.start(signal);
      return Promise.resolve();
    });
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.authorized()) {
        this.stop();
        return;
      }
      const now = Date.now();
      this.elapsed += Math.max(0, now - this.lastClock);
      this.lastClock = now;
      this.context.advanceTo(this.elapsed);
      this.publishContext();
      if (
        this.meetingProfile === 'video-fact-check' &&
        this.remaining > 0 &&
        now >= this.videoCheckAt &&
        this.signature !== this.videoSignature
      ) {
        const context = this.context.snapshot();
        const recent =
          context?.recent.filter(
            (segment) =>
              segment.type === 'final' && segment.source === 'system',
          ) ?? [];
        if (recent.length > 0) {
          this.videoSignature = this.signature;
          this.videoCheckAt = now + 20_000;
          this.scheduler.submit(
            {
              recent,
              summary:
                context?.summary.filter(
                  (segment) => segment.source === 'system',
                ) ?? [],
            },
            ++this.revision,
            'automatic',
          );
        }
      }
    }, 1000);
  }

  stop(): void {
    this.generation += 1;
    this.enabled = false;
    this.pause();
    this.context.clear();
    this.provider = undefined;
    this.remaining = 0;
    this.failed = false;
    this.revision = 0;
    this.signature = '';
    this.elapsed = 0;
    this.model = '';
    this.userContext = '';
    this.meetingProfile = undefined;
    this.maxRequests = 0;
    this.lastTrigger = 'none';
    this.hasFinal = false;
    this.lastAttempt = null;
    this.videoSignature = '';
    this.videoCheckAt = 0;
    this.videoSeen.clear();
    this.results.clear();
  }

  dismiss(id: string): void {
    this.scheduler.dismiss(id);
  }

  citationUrl(id: string): string | undefined {
    if (!this.authorized()) return undefined;
    const citation = this.scheduler
      .snapshot()
      .find((item) => item.id === id)?.citation;
    return parseCitation(citation)?.url;
  }

  rate(id: string, value: SuggestionFeedbackValue): void {
    if (!this.scheduler.snapshot().some((suggestion) => suggestion.id === id))
      return;
    this.feedback.rate(id, value);
  }

  clearFeedback(): void {
    this.feedback.clear();
  }

  snapshot(): SuggestionSessionSnapshot {
    if (!this.enabled)
      return {
        ...emptySuggestionSession(),
        feedback: this.feedback.snapshot(),
      };
    const activity = this.scheduler.activity();
    const diagnostics: SuggestionDiagnostics = {
      model: this.model,
      maxRequests: this.maxRequests,
      lastTrigger: this.lastTrigger,
      activity: !this.authorized()
        ? 'paused'
        : activity === 'generating'
          ? this.lastAttempt?.requestBody
            ? 'requesting'
            : 'preparing'
          : activity !== 'idle'
            ? activity
            : this.hasFinal
              ? 'waiting-trigger'
              : 'waiting-final',
      lastAttempt: this.lastAttempt ? { ...this.lastAttempt } : null,
    };
    return {
      diagnostics,
      feedback: this.feedback.snapshot(),
      items: this.scheduler.snapshot(),
      remainingRequests: this.remaining,
      status: this.failed
        ? 'unavailable'
        : this.remaining === 0
          ? 'exhausted'
          : 'ready',
    };
  }

  resultSnapshot(): MeetingResultsSnapshot {
    return this.results.snapshot();
  }
}
