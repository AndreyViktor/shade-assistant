import { describe, expect, it, vi } from 'vitest';
import { MeetingSession } from './MeetingSession';
import type { SessionMode } from '../../contracts/meeting/session';

const consent = { capture: true, context: true, remoteAudio: true };
function started(mode: SessionMode = 'apple-local') {
  const session = new MeetingSession();
  expect(session.start({ mode, consent })).toBe(true);
  return session;
}

describe('session lifecycle and consent', () => {
  it('requires manual start and valid transitions; stop is idempotent', () => {
    const session = new MeetingSession();
    expect(session.permits('capture')).toBe(false);
    expect(session.pause()).toBe(false);
    expect(session.resume()).toBe(false);
    expect(
      session.start({
        mode: 'apple-local',
        consent: { ...consent, capture: false },
      }),
    ).toBe(false);
    expect(
      session.start({
        mode: 'openai-stt',
        consent: { ...consent, remoteAudio: false },
      }),
    ).toBe(false);
    expect(session.start({ mode: 'apple-local', consent })).toBe(true);
    expect(session.start({ mode: 'demo', consent })).toBe(false);
    expect(session.pause()).toBe(true);
    expect(session.pause()).toBe(false);
    expect(session.start({ mode: 'demo', consent })).toBe(false);
    expect(session.resume()).toBe(true);
    expect(session.resume()).toBe(false);
    session.stop();
    session.stop();
    expect(session.resume()).toBe(false);
    expect(session.snapshot()).toMatchObject({
      phase: 'stopped',
      consent: { capture: false, context: false, remoteAudio: false },
    });
    expect(session.start({ mode: 'demo', consent })).toBe(true);
  });

  it('separates audio, context and demo permissions without sharing mutable consent', () => {
    const local = started();
    expect(local.permits('capture')).toBe(true);
    expect(local.permits('context')).toBe(true);
    expect(local.permits('remote-audio')).toBe(false);
    expect(local.permits('demo')).toBe(false);
    const snapshot = local.snapshot();
    snapshot.consent.context = false;
    expect(local.permits('context')).toBe(true);
    const remote = started('openai-stt');
    expect(remote.permits('remote-audio')).toBe(true);
    const demo = started('demo');
    expect(demo.permits('demo')).toBe(true);
    for (const kind of ['capture', 'context', 'remote-audio'] as const)
      expect(demo.permits(kind)).toBe(false);
    const noText = new MeetingSession();
    const options = {
      mode: 'apple-local' as const,
      consent: { ...consent, context: false },
    };
    noText.start(options);
    options.consent.context = true;
    expect(noText.permits('context')).toBe(false);
  });

  it.each(['pause', 'stop'] as const)(
    '%s aborts in-flight work, rejects queued sends and discards late results after resume/restart',
    async (action) => {
      const session = started('openai-stt');
      let finish: (value: string) => void = () => {};
      let signal: AbortSignal | undefined;
      const result = session.run('context', (current) => {
        signal = current;
        return new Promise<string>((resolve) => {
          finish = resolve;
        });
      });
      session[action]();
      expect(signal?.aborted).toBe(true);
      const send = vi.fn().mockResolvedValue('sent');
      for (const kind of [
        'capture',
        'context',
        'remote-audio',
        'demo',
      ] as const)
        expect(await session.run(kind, send)).toBeUndefined();
      expect(send).not.toHaveBeenCalled();
      if (action === 'pause') session.resume();
      else session.start({ mode: 'openai-stt', consent });
      finish('stale');
      expect(await result).toBeUndefined();
      expect(await session.run('context', send)).toBe('sent');
    },
  );

  it('suppresses cancellation failures but propagates active errors', async () => {
    const session = started();
    await expect(
      session.run('context', () => Promise.reject(new Error('active'))),
    ).rejects.toThrow('active');
    const result = session.run(
      'context',
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new Error('cancelled')),
            { once: true },
          );
        }),
    );
    session.stop();
    await expect(result).resolves.toBeUndefined();
  });
});
