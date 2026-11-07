import type {
  SessionSnapshot,
  SessionStart,
} from '../../contracts/meeting/session';

type WorkKind = 'demo' | 'capture' | 'context' | 'remote-audio';
const noConsent = () => ({
  capture: false,
  context: false,
  remoteAudio: false,
});

/** One in-memory authority. Adapters must use run() at the moment work starts. */
export class MeetingSession {
  private state: SessionSnapshot = {
    phase: 'idle',
    mode: 'demo',
    consent: noConsent(),
  };
  private generation = new AbortController();

  snapshot(): SessionSnapshot {
    return { ...this.state, consent: { ...this.state.consent } };
  }

  start(options: SessionStart): boolean {
    if (this.state.phase === 'running' || this.state.phase === 'paused')
      return false;
    if (options.mode !== 'demo' && !options.consent.capture) return false;
    if (options.mode === 'openai-stt' && !options.consent.remoteAudio)
      return false;
    if (options.mode === 'apple-local' && options.consent.remoteAudio)
      return false;
    // Demo never grants cloud/capture permission, even to a crafted caller.
    this.state = {
      phase: 'running',
      mode: options.mode,
      consent: options.mode === 'demo' ? noConsent() : { ...options.consent },
    };
    this.invalidate();
    return true;
  }

  pause(): boolean {
    if (this.state.phase !== 'running') return false;
    this.state.phase = 'paused';
    this.invalidate();
    return true;
  }

  resume(): boolean {
    if (this.state.phase !== 'paused') return false;
    this.state.phase = 'running';
    return true;
  }

  stop(): void {
    this.state = { ...this.state, phase: 'stopped', consent: noConsent() };
    this.invalidate();
  }

  permits(kind: WorkKind): boolean {
    if (this.state.phase !== 'running') return false;
    if (this.state.mode === 'demo') return kind === 'demo';
    if (kind === 'capture') return this.state.consent.capture;
    if (kind === 'context') return this.state.consent.context;
    return (
      kind === 'remote-audio' &&
      this.state.mode === 'openai-stt' &&
      this.state.consent.remoteAudio
    );
  }

  async run<T>(
    kind: WorkKind,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | undefined> {
    if (!this.permits(kind)) return undefined;
    const signal = this.generation.signal;
    try {
      const result = await work(signal);
      return signal.aborted ? undefined : result;
    } catch (error) {
      if (signal.aborted) return undefined;
      throw error;
    }
  }

  private invalidate(): void {
    const previous = this.generation;
    this.generation = new AbortController();
    previous.abort();
  }
}
