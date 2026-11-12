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
  private maxRequests = 0;
  private lastTrigger: Trigger = 'none';
  private hasFinal = false;
  private lastAttempt: SuggestionAttempt | null = null;

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
      {},
      true,
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
    this.maxRequests = authorization.maxRequests;
    const generation = this.generation;
    try {
      this.provider = this.createProvider(
        authorization,
        () => generation === this.generation && this.authorized(),
      );
    } catch {
      this.failed = true;
      return;
    }
    this.context.start(config);
    this.lastClock = Date.now();
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

  private publishContext(event?: TranscriptionEvent): void {
    const context = this.context.snapshot();
    if (!context) return;
    // Partial hypotheses never trigger requests or enter the provider context.
    const finalContext: MeetingContext = {
      recent: context.recent.filter((segment) => segment.type === 'final'),
      summary: context.summary,
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
    if (event?.type === 'final')
      this.lastTrigger = this.trigger.evaluate(event);
    this.scheduler.submit(
      finalContext,
      ++this.revision,
      this.remaining > 0 && event?.type === 'final' ? 'automatic' : 'none',
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
    this.maxRequests = 0;
    this.lastTrigger = 'none';
    this.hasFinal = false;
    this.lastAttempt = null;
  }

  dismiss(id: string): void {
    this.scheduler.dismiss(id);
  }

  snapshot(): SuggestionSessionSnapshot {
    if (!this.enabled) return emptySuggestionSession();
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
      items: this.scheduler.snapshot(),
      remainingRequests: this.remaining,
      status: this.failed
        ? 'unavailable'
        : this.remaining === 0
          ? 'exhausted'
          : 'ready',
    };
  }
}
