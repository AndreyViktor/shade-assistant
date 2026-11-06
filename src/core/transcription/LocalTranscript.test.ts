import { describe, expect, it } from 'vitest';
import { LocalTranscript } from './LocalTranscript';
import {
  MAX_VISIBLE_SEGMENTS,
  parseLocalTranscript,
} from '../../contracts/meeting/localTranscript';
import type {
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../contracts/native/protocol';

const config: TranscriptionConfig = {
  sessionId: 'test',
  sources: ['mic', 'system'],
  locale: 'pt-BR',
};
const speech = (
  seq: number,
  changes: Partial<TranscriptionEvent> = {},
): TranscriptionEvent =>
  ({
    version: 1,
    sessionId: config.sessionId,
    source: 'mic',
    locale: 'pt-BR',
    seq,
    timestampMs: seq * 100,
    type: 'final',
    segmentId: `segment-${seq}`,
    startMs: 0,
    endMs: seq * 100,
    text: 'Fala sintética',
    ...changes,
  }) as TranscriptionEvent;

describe('bounded local display window', () => {
  it('preserves source identity, replaces a partial with its final and bounds retained speech', () => {
    const window = new LocalTranscript();
    window.start(config);
    window.receive(speech(1, { type: 'partial', segmentId: 'same' }), true);
    window.receive(speech(1, { source: 'system', segmentId: 'same' }), true);
    window.receive(speech(2, { segmentId: 'same', text: 'Fala final' }), true);
    expect(
      window.snapshot()?.segments.map((s) => [s.source, s.type, s.text]),
    ).toEqual([
      ['system', 'final', 'Fala sintética'],
      ['mic', 'final', 'Fala final'],
    ]);
    window.receive(speech(3, { type: 'partial', segmentId: 'same' }), true);
    expect(
      window.snapshot()?.segments.find((segment) => segment.source === 'mic')
        ?.type,
    ).toBe('final');
    for (let i = 4; i < 40; i++) window.receive(speech(i), true);
    expect(window.snapshot()?.segments).toHaveLength(MAX_VISIBLE_SEGMENTS);
    expect(window.snapshot()?.segments[0]?.seq).toBe(28);
    expect(parseLocalTranscript(window.snapshot())).toEqual(window.snapshot());
  });

  it('ignores old sessions, duplicate sequence, unselected sources, wrong locale and paused speech', () => {
    const window = new LocalTranscript();
    window.start({ ...config, sources: ['mic'] });
    for (const changes of [
      { sessionId: 'old' },
      { source: 'system' as const },
      { locale: 'en-US' as const },
    ])
      expect(window.receive(speech(1, changes), true)).toBe(false);
    window.receive(speech(1), true);
    expect(window.receive(speech(1), true)).toBe(false);
    expect(window.receive(speech(2), false)).toBe(false);
    expect(window.snapshot()?.segments).toHaveLength(1);
    window.clear();
    expect(window.receive(speech(3), true)).toBe(false);
    expect(window.snapshot()).toBeNull();
    window.start({ ...config, sessionId: 'new' });
    expect(window.receive(speech(4), true)).toBe(false);
    expect(window.snapshot()?.segments).toEqual([]);
  });

  it('copies snapshots and drops all speech on failure without losing diagnostic state', () => {
    const window = new LocalTranscript();
    window.start(config);
    window.receive(speech(1), true);
    const snapshot = window.snapshot();
    snapshot?.segments.splice(0);
    snapshot?.config.sources.splice(0);
    expect(window.snapshot()?.segments).toHaveLength(1);
    window.fail();
    expect(window.snapshot()).toMatchObject({ failed: true, segments: [] });
    window.clear();
    expect(window.snapshot()).toBeNull();
  });

  it('drops only the paused source hypotheses, retains finals and resumes on the same session clock', () => {
    const window = new LocalTranscript();
    window.start(config);
    window.receive(speech(1), true);
    window.receive(
      speech(2, { type: 'partial', startMs: 150, endMs: 200 }),
      true,
    );
    window.receive(speech(1, { source: 'system', type: 'partial' }), true);
    const status: TranscriptionEvent = {
      version: 1,
      sessionId: config.sessionId,
      source: 'mic',
      locale: config.locale,
      seq: 3,
      timestampMs: 400,
      type: 'status',
      state: 'paused',
    };
    window.receive(status, false);
    expect(
      window
        .snapshot()
        ?.segments.map((segment) => [segment.source, segment.type]),
    ).toEqual([
      ['mic', 'final'],
      ['system', 'partial'],
    ]);
    window.receive(speech(4, { type: 'partial' }), false);
    window.receive(
      { ...status, seq: 5, timestampMs: 500, state: 'listening' },
      false,
    );
    window.receive(speech(6, { startMs: 500, endMs: 600 }), true);
    expect(window.snapshot()?.segments.at(-1)).toMatchObject({
      seq: 6,
      startMs: 500,
      endMs: 600,
    });
    expect(window.receive(speech(4), true)).toBe(false);
    expect(parseLocalTranscript(window.snapshot())).toEqual(window.snapshot());
  });
});
