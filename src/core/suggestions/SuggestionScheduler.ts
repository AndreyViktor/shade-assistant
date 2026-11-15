import { SuggestionStore } from './SuggestionStore';
import type { MeetingContext } from '../meeting/ContextManager';
import type { SuggestionProvider } from './SuggestionProvider';
import type { Trigger } from './TriggerEngine';

export type SuggestionPolicy = {
  debounceMs: number;
  cooldownMs: number;
  ttlMs: number | null;
  maxResponseAgeMs: number;
};

export const DEFAULT_SUGGESTION_POLICY: Readonly<SuggestionPolicy> =
  Object.freeze({
    debounceMs: 500,
    cooldownMs: 10_000,
    ttlMs: 30_000,
    maxResponseAgeMs: 15_000,
  });

type Pending = {
  context: MeetingContext;
  manual: boolean;
  dueAt: number;
};

/** Host supplies validated, bounded context and a monotonically increasing
 * revision for each new final/context change (not partials or silence).
 * Authorization must include active session, consent and budget; manual is no
 * exemption. MeetingSuggestions owns session lifecycle and budget.
 */
export class SuggestionScheduler {
  private readonly policy: SuggestionPolicy;
  private readonly store: SuggestionStore;
  private session: AbortSignal | undefined;
  private revision = -1;
  private pending: Pending | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active: AbortController | undefined;
  private lastStarted = -Infinity;
  private nextId = 0;

  constructor(
    private readonly provider: SuggestionProvider,
    private readonly isAuthorized: () => boolean,
    private readonly language: 'pt-BR' | 'en-US' = 'pt-BR',
    policy: Partial<SuggestionPolicy> = {},
    private readonly continuous = false,
  ) {
    this.policy = { ...DEFAULT_SUGGESTION_POLICY, ...policy };
    for (const [key, value] of Object.entries(this.policy)) {
      if (key === 'ttlMs' && value === null) continue;
      if (
        value === null ||
        !Number.isSafeInteger(value) ||
        value < (key === 'debounceMs' || key === 'cooldownMs' ? 0 : 1) ||
        value > 2_147_483_647
      )
        throw new Error('Invalid suggestion policy');
    }
    this.store = new SuggestionStore(() => Date.now(), this.policy.ttlMs);
  }

  start(signal: AbortSignal): void {
    this.stop();
    if (signal.aborted) return;
    this.session = signal;
    signal.addEventListener('abort', this.stop, { once: true });
  }

  /** In continuous mode, retain active work and coalesce newer final contexts.
   * In the original mode, a newer revision invalidates older work.
   * Manual may reuse the current revision but never an older one.
   */
  submit(
    context: MeetingContext,
    revision: number,
    trigger: Trigger | 'automatic',
  ): void {
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new Error('Invalid context revision');
    if (!this.permitted()) {
      this.invalidate();
      return;
    }
    if (revision < this.revision) return;
    if (revision === this.revision && trigger !== 'manual') return;
    this.revision = revision;
    const previousDueAt = this.pending?.dueAt;
    if (!this.continuous) this.invalidate();
    if (trigger === 'none') return;
    this.pending = {
      context: {
        recent: context.recent.map((segment) => ({ ...segment })),
        summary: context.summary.map((excerpt) => ({ ...excerpt })),
      },
      manual: trigger === 'manual',
      dueAt:
        this.continuous && previousDueAt !== undefined
          ? previousDueAt
          : Date.now() + (trigger === 'manual' ? 0 : this.policy.debounceMs),
    };
    this.arm();
  }

  /** Hides current cards and cancels work; bounded duplicate suppression survives. */
  invalidate(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
    this.active?.abort();
    this.store.invalidate();
  }

  /** Also used for pause/revocation. Resume starts a fresh session generation. */
  stop = (): void => {
    this.session?.removeEventListener('abort', this.stop);
    this.session = undefined;
    this.invalidate();
    this.store.clear();
    this.revision = -1;
    this.lastStarted = -Infinity;
    // Keep the active slot until settlement: cancellation is cooperative and
    // must not create overlapping provider calls, even across a restart.
  };

  snapshot() {
    if (!this.permitted()) this.invalidate();
    return this.store.snapshot();
  }

  dismiss(id: string): void {
    this.store.dismiss(id);
  }

  activity(): 'idle' | 'debounce' | 'cooldown' | 'generating' {
    if (this.active && !this.active.signal.aborted) return 'generating';
    if (!this.pending) return 'idle';
    return Date.now() < this.pending.dueAt ? 'debounce' : 'cooldown';
  }

  private permitted(): boolean {
    return !!this.session && !this.session.aborted && this.isAuthorized();
  }

  private arm(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.pending || this.active) return;
    const dueAt = Math.max(
      this.pending.dueAt,
      this.pending.manual
        ? -Infinity
        : this.lastStarted + this.policy.cooldownMs,
    );
    if (dueAt > Date.now()) {
      this.timer = setTimeout(() => this.arm(), dueAt - Date.now());
      return;
    }
    if (!this.permitted()) {
      this.invalidate();
      return;
    }
    const pending = this.pending;
    this.pending = undefined;
    const controller = new AbortController();
    this.active = controller;
    this.lastStarted = Date.now();
    void this.generate(pending, controller);
  }

  private async generate(
    pending: Pending,
    controller: AbortController,
  ): Promise<void> {
    const deadline = Date.now() + this.policy.maxResponseAgeMs;
    const timeout = setTimeout(
      () => controller.abort(),
      this.policy.maxResponseAgeMs,
    );
    const clearDeadline = () => clearTimeout(timeout);
    controller.signal.addEventListener('abort', clearDeadline, { once: true });
    try {
      const result = await this.provider.generate({
        context: pending.context,
        language: this.language,
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        Date.now() >= deadline ||
        !this.permitted() ||
        !result.ok
      )
        return;
      for (const content of result.suggestions)
        this.store.add(`suggestion-${++this.nextId}`, content);
    } catch {
      // A faulty adapter must not leak meeting text or an unhandled rejection.
      // Safe provider failures and unexpected exceptions both leave silence.
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener('abort', clearDeadline);
      this.active = undefined;
      this.arm();
    }
  }
}
