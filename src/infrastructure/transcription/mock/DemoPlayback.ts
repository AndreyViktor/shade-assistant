import { emptyDemo } from '../../../contracts/meeting/demo';
import type { DemoSnapshot } from '../../../contracts/meeting/demo';
import type { MeetingSession } from '../../../core/meeting/MeetingSession';
import { demoScript } from './demoScript';

/** Bounded synthetic playback, owned by the main process for one session. */
export class DemoPlayback {
  private state = emptyDemo();
  private turn = 0;
  private stage: 'transcript' | 'suggestion' = 'transcript';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  constructor(private readonly session: Pick<MeetingSession, 'permits'>) {}

  snapshot(): DemoSnapshot {
    return {
      ...this.state,
      transcript: this.state.transcript ? { ...this.state.transcript } : null,
      suggestion: this.state.suggestion ? { ...this.state.suggestion } : null,
    };
  }

  start(): void {
    this.stop();
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
            suggestion: null,
            completed: false,
          };
          this.stage = 'suggestion';
        } else {
          this.state.suggestion =
            next.suggestion === null
              ? null
              : { sequence: next.transcript.sequence, text: next.suggestion };
          this.turn += 1;
          this.stage = 'transcript';
          this.state.completed = this.turn === demoScript.length;
        }
        this.resume();
      },
      this.stage === 'transcript' ? 2000 : 1000,
    );
  }

  stop(): void {
    this.pause();
    this.state = emptyDemo();
    this.turn = 0;
    this.stage = 'transcript';
  }
}
