// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingSession } from '../../../core/meeting/MeetingSession';
import { emptyDemo, parseDemoSnapshot } from '../../../contracts/meeting/demo';
import { DemoPlayback } from './DemoPlayback';

const options = {
  mode: 'demo' as const,
  consent: { capture: false, context: false, remoteAudio: false },
};
function setup() {
  const session = new MeetingSession();
  const demo = new DemoPlayback(session);
  session.start(options);
  demo.start();
  return { session, demo };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('deterministic offline playback', () => {
  it('produces both synthetic sources, silence and grounded suggestions in a finite repeatable sequence', () => {
    const { session, demo } = setup();
    expect(demo.snapshot()).toEqual(emptyDemo());
    const firstRun = [];
    for (let sequence = 1; sequence <= 3; sequence += 1) {
      vi.advanceTimersByTime(2000);
      expect(demo.snapshot()).toMatchObject({
        transcript: {
          sequence,
          source: sequence === 2 ? 'system' : 'mic',
          locale: 'pt-BR',
        },
        suggestion: null,
      });
      vi.advanceTimersByTime(1000);
      const snapshot = demo.snapshot();
      expect(parseDemoSnapshot(snapshot)).toEqual(snapshot);
      if (sequence === 1) expect(snapshot.suggestion).toBeNull();
      else expect(snapshot.suggestion).toMatchObject({ sequence });
      firstRun.push(snapshot);
    }
    expect(demo.snapshot().completed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3600000);
    expect(demo.snapshot()).toEqual(firstRun.at(-1));
    session.stop();
    demo.stop();
    expect(demo.snapshot()).toEqual(emptyDemo());
    session.start(options);
    demo.start();
    const secondRun = [];
    for (let turn = 0; turn < 3; turn += 1) {
      vi.advanceTimersByTime(3000);
      secondRun.push(demo.snapshot());
    }
    expect(secondRun).toEqual(firstRun);
    expect(session.snapshot().consent).toEqual(options.consent);
  });

  it.each([1000, 5000])(
    'pauses at %i ms without losing or duplicating the pending stage',
    (elapsed) => {
      const { session, demo } = setup();
      vi.advanceTimersByTime(elapsed);
      session.pause();
      demo.pause();
      const paused = demo.snapshot();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(60000);
      expect(demo.snapshot()).toEqual(paused);
      demo.resume();
      expect(vi.getTimerCount()).toBe(0);
      session.resume();
      demo.resume();
      demo.resume();
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(elapsed === 1000 ? 2000 : 1000);
      if (elapsed === 1000)
        expect(demo.snapshot().transcript?.sequence).toBe(1);
      else expect(demo.snapshot().suggestion?.sequence).toBe(2);
    },
  );

  it.each([0, 2000, 5000, 9000])(
    'stop at %i ms clears data/timers and restart begins at the first source',
    (elapsed) => {
      const { session, demo } = setup();
      vi.advanceTimersByTime(elapsed);
      session.stop();
      demo.stop();
      demo.stop();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(60000);
      expect(demo.snapshot()).toEqual(emptyDemo());
      session.start(options);
      demo.start();
      vi.advanceTimersByTime(2000);
      expect(demo.snapshot().transcript?.sequence).toBe(1);
    },
  );

  it('never advances when the session denies demo work, even if cleanup has not run yet', () => {
    const session = new MeetingSession();
    const demo = new DemoPlayback(session);
    demo.start();
    expect(vi.getTimerCount()).toBe(0);
    session.start(options);
    demo.start();
    session.stop();
    vi.advanceTimersByTime(10000);
    expect(demo.snapshot()).toEqual(emptyDemo());
    expect(vi.getTimerCount()).toBe(0);
    session.start({
      mode: 'apple-local',
      consent: { ...options.consent, capture: true },
    });
    demo.start();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns independent snapshots without letting a caller mutate the script or future results', () => {
    const { demo } = setup();
    vi.advanceTimersByTime(6000);
    const snapshot = demo.snapshot();
    if (!snapshot.transcript || !snapshot.suggestion)
      throw new Error('Missing fixture');
    snapshot.transcript.text = 'changed';
    snapshot.suggestion.text = 'changed';
    expect(demo.snapshot().transcript?.text).not.toBe('changed');
    expect(demo.snapshot().suggestion?.text).not.toBe('changed');
    demo.start();
    vi.advanceTimersByTime(6000);
    expect(demo.snapshot().transcript?.text).not.toBe('changed');
  });
});
