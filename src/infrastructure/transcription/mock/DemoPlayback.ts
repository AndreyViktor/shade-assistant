import { SuggestionStore } from '../../../core/suggestions/SuggestionStore';
import { emptyDemo } from '../../../contracts/meeting/demo';
import type { DemoSnapshot } from '../../../contracts/meeting/demo';
import type { MeetingSession } from '../../../core/meeting/MeetingSession';
import { demoScript } from './demoScript';

/** Bounded synthetic playback, owned by the main process for one session. */
export class DemoPlayback {
  private state = emptyDemo();
  private readonly suggestions = new SuggestionStore();
  private run = 0;
  private turn = 0;
  private stage: 'transcript' | 'suggestion' = 'transcript';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  constructor(private readonly session: Pick<MeetingSession, 'permits'>) {}

  snapshot(): DemoSnapshot {
    return {
      ...this.state,
      transcript: this.state.transcript ? { ...this.state.transcript } : null,
      suggestions: this.suggestions.snapshot(),
    };
  }

  start(): void {
    this.stop();
    this.run += 1;
    this.resume();
  }

  pause(): void {
    this.generation += 1;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  resume(): void {
    if (
      this.timer !== undefined ||
      this.state.completed ||
      !this.session.permits('demo')
    )
      return;
    const generation = this.generation;
    // Resume restarts the pending stage's delay; it never skips a turn.
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        if (generation !== this.generation || !this.session.permits('demo'))
          return;
        const next = demoScript[this.turn];
        if (!next) return;
        if (this.stage === 'transcript') {
          this.state = {
            transcript: { ...next.transcript },
            suggestions: [],
            completed: false,
          };
          this.stage = 'suggestion';
        } else {
          if (next.suggestion)
            this.suggestions.add(
              `demo-${this.run}-${next.transcript.sequence}`,
              next.suggestion,
            );
          this.turn += 1;
          this.stage = 'transcript';
          this.state.completed = this.turn === demoScript.length;
        }
        this.resume();
      },
      this.stage === 'transcript' ? 2000 : 1000,
    );
  }

  dismiss(id: string): void {
    this.suggestions.dismiss(id);
  }

  stop(): void {
    this.pause();
    this.state = emptyDemo();
    this.suggestions.clear();
    this.turn = 0;
    this.stage = 'transcript';
  }
}
