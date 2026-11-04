// @vitest-environment node
import type { BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSessionIpc } from './registerSessionIpc';
import { emptyDemo } from '../../contracts/meeting/demo';
import {
  parseSessionResult,
  SESSION_CHANNEL,
} from '../../contracts/ipc/session';
const mocks = vi.hoisted(() => ({
  handle:
    vi.fn<
      (
        channel: string,
        listener: (event: unknown, ...args: unknown[]) => unknown,
      ) => void
    >(),
  removeHandler: vi.fn(),
}));
vi.mock('electron', () => ({ ipcMain: mocks }));
const start = {
  version: 2,
  action: 'start',
  options: {
    mode: 'demo',
    consent: { capture: false, context: false, remoteAudio: false },
  },
};
function setup() {
  const frame = { url: 'file:///renderer.html' };
  const window = {
    isDestroyed: () => false,
    webContents: {
      mainFrame: frame,
      on: vi.fn<(event: string, callback: () => void) => void>(),
    },
    once: vi.fn<(event: string, callback: () => void) => void>(),
  };
  registerSessionIpc(window as unknown as BrowserWindow, frame.url);
  const listener = mocks.handle.mock.calls.at(-1)?.[1];
  if (!listener) throw new Error('Missing handler');
  const event = { sender: window.webContents, senderFrame: frame };
  return {
    window,
    event,
    listener,
    call: (request: unknown) => listener(event, request),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe('session main boundary', () => {
  it('owns dismissal, pause-time expiry and cleanup without replaying dismissed cards', () => {
    const { call } = setup();
    const read = () => parseSessionResult(call({ version: 2, action: 'read' }));
    call(start);
    vi.advanceTimersByTime(9000);
    const full = read();
    if (!full.ok) throw new Error('Missing snapshot');
    const first = full.demo.suggestions[0];
    if (!first) throw new Error('Missing card');
    expect(full.demo.suggestions).toHaveLength(2);
    call({ version: 2, action: 'pause' });
    call({ version: 2, action: 'dismiss-suggestion', id: first.id });
    expect(read()).toMatchObject({
      demo: { suggestions: [{ category: 'action' }] },
    });
    call({ version: 2, action: 'dismiss-suggestion', id: first.id });
    vi.advanceTimersByTime(30000);
    expect(read()).toMatchObject({
      session: { phase: 'paused' },
      demo: { suggestions: [] },
    });
    call({ version: 2, action: 'resume' });
    expect(read()).toMatchObject({ demo: { suggestions: [] } });
    call({ version: 2, action: 'stop' });
    call(start);
    vi.advanceTimersByTime(9000);
    call({ version: 2, action: 'dismiss-suggestion', id: first.id });
    const restarted = read();
    if (!restarted.ok) throw new Error('Missing snapshot');
    expect(restarted.demo.suggestions).toHaveLength(2);
    expect(restarted.demo.suggestions[0]?.id).not.toBe(first.id);
  });

  it('publishes deterministic demo data only after start and clears it on stop', () => {
    const { call } = setup();
    const read = () => call({ version: 2, action: 'read' });
    vi.advanceTimersByTime(10000);
    expect(read()).toMatchObject({ demo: emptyDemo() });
    call(start);
    vi.advanceTimersByTime(5000);
    expect(read()).toMatchObject({
      demo: { transcript: { sequence: 2, source: 'system' }, suggestions: [] },
    });
    call({ version: 2, action: 'pause' });
    const paused = read();
    vi.advanceTimersByTime(10000);
    expect(read()).toEqual(paused);
    call({ version: 2, action: 'resume' });
    vi.advanceTimersByTime(1000);
    expect(read()).toMatchObject({
      demo: { suggestions: [{ category: 'question' }] },
    });
    call({ version: 2, action: 'stop' });
    vi.advanceTimersByTime(10000);
    expect(read()).toMatchObject({ demo: emptyDemo() });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('owns state across reads, allows only manual demo and prevents invalid transitions', () => {
    const { call } = setup();
    expect(call({ version: 2, action: 'read' })).toMatchObject({
      session: { phase: 'idle' },
    });
    expect(
      call({ ...start, options: { ...start.options, mode: 'apple-local' } }),
    ).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
    expect(
      call({ ...start, options: { ...start.options, mode: 'openai-stt' } }),
    ).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
    expect(call(start)).toMatchObject({
      session: { phase: 'running', mode: 'demo' },
    });
    expect(call(start)).toMatchObject({ ok: false });
    for (const [action, phase] of [
      ['pause', 'paused'],
      ['read', 'paused'],
      ['resume', 'running'],
      ['stop', 'stopped'],
      ['stop', 'stopped'],
    ]) {
      expect(call({ version: 2, action })).toMatchObject({
        session: { phase },
      });
    }
    expect(call({ version: 2, action: 'resume' })).toMatchObject({ ok: false });
  });
  it('rejects unauthorized frames, malformed arguments and cloud flags in demo', () => {
    const { call, listener, event } = setup();
    for (const foreign of [
      { ...event, sender: {} },
      { ...event, senderFrame: { url: 'file:///renderer.html' } },
      { ...event, senderFrame: null },
    ]) {
      expect(listener(foreign, start)).toEqual({
        version: 2,
        ok: false,
        code: 'FORBIDDEN',
      });
    }
    for (const request of [
      null,
      { ...start, version: 99 },
      { ...start, secret: 'synthetic' },
    ])
      expect(call(request)).toMatchObject({
        ok: false,
        code: 'INVALID_REQUEST',
      });
    expect(listener(event, start, 'extra')).toMatchObject({
      ok: false,
      code: 'INVALID_REQUEST',
    });
    expect(
      call({
        ...start,
        options: {
          mode: 'demo',
          consent: { capture: true, context: true, remoteAudio: true },
        },
      }),
    ).toMatchObject({ session: { consent: start.options.consent } });
  });
  it('stops on reload/crash/close and removes the handler for a fresh window', () => {
    const { call, window } = setup();
    for (const name of ['did-start-loading', 'render-process-gone']) {
      call(start);
      const callback = window.webContents.on.mock.calls.find(
        ([event]) => event === name,
      )?.[1];
      if (!callback) throw new Error('Missing cleanup');
      vi.advanceTimersByTime(6000);
      callback();
      expect(vi.getTimerCount()).toBe(0);
      expect(call({ version: 2, action: 'read' })).toMatchObject({
        demo: emptyDemo(),
      });
      expect(call({ version: 2, action: 'read' })).toMatchObject({
        session: { phase: 'stopped' },
      });
    }
    call(start);
    vi.advanceTimersByTime(6000);
    window.once.mock.calls[0]?.[1]();
    expect(vi.getTimerCount()).toBe(0);
    expect(call({ version: 2, action: 'read' })).toMatchObject({
      demo: emptyDemo(),
    });
    expect(call({ version: 2, action: 'read' })).toMatchObject({
      session: { phase: 'stopped' },
    });
    expect(mocks.removeHandler).toHaveBeenCalledWith(SESSION_CHANNEL);
    expect(setup().call({ version: 2, action: 'read' })).toMatchObject({
      session: { phase: 'idle' },
    });
  });
});
