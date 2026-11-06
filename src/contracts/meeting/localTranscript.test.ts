import { describe, expect, it } from 'vitest';
import { parseLocalTranscript, MAX_VISIBLE_SEGMENTS } from './localTranscript';
import { parseSessionResult } from '../ipc/session';
import { emptyDemo } from './demo';

const event = {
  version: 1,
  sessionId: 'test',
  source: 'mic',
  locale: 'pt-BR',
  seq: 1,
  timestampMs: 100,
  type: 'final',
  segmentId: 's1',
  startMs: 0,
  endMs: 100,
  text: 'Fala sintética',
};
const snapshot = {
  failed: false,
  config: { sessionId: 'test', sources: ['mic'], locale: 'pt-BR' },
  channels: [],
  segments: [event],
};
const reply = {
  version: 3,
  ok: true,
  session: {
    mode: 'apple-local',
    phase: 'running',
    consent: { capture: true, context: false, remoteAudio: false },
  },
  demo: emptyDemo(),
  local: snapshot,
};

describe('local transcript IPC contract', () => {
  it('accepts validated bounded content and rejects legacy session versions', () => {
    expect(parseLocalTranscript(snapshot)).toEqual(snapshot);
    expect(parseSessionResult(reply)).toEqual(reply);
    for (const version of [1, 2, 4])
      expect(parseSessionResult({ ...reply, version }).ok).toBe(false);
    expect(
      parseSessionResult({
        ...reply,
        session: {
          ...reply.session,
          mode: 'demo',
          consent: { capture: false, context: false, remoteAudio: false },
        },
      }).ok,
    ).toBe(false);
  });
  it.each([
    undefined,
    {},
    { ...snapshot, failed: 'yes' },
    { ...snapshot, private: 'secret' },
    { ...snapshot, config: { ...snapshot.config, extra: true } },
    { ...snapshot, config: { ...snapshot.config, sources: ['mic', 'mic'] } },
    {
      ...snapshot,
      segments: Array.from({ length: MAX_VISIBLE_SEGMENTS + 1 }, (_, i) => ({
        ...event,
        segmentId: `s${i}`,
      })),
    },
    { ...snapshot, segments: [event, event] },
    { ...snapshot, segments: [{ ...event, text: 'x'.repeat(4097) }] },
    { ...snapshot, segments: [{ ...event, sessionId: 'old' }] },
    { ...snapshot, segments: [{ ...event, source: 'system' }] },
    { ...snapshot, segments: [{ ...event, locale: 'en-US' }] },
    { ...snapshot, segments: [{ ...event, extra: 'private' }] },
    { ...snapshot, channels: [event] },
  ])(
    'rejects malformed or excessive data without echoing content %#',
    (local) => {
      expect(parseSessionResult({ ...reply, local })).toEqual({
        version: 3,
        ok: false,
        code: 'INVALID_RESPONSE',
      });
    },
  );
});
