// @vitest-environment node
import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_STATUS,
  APP_STATUS_CHANNEL,
  ipcFailure,
} from '../../contracts/ipc/appStatus';
import { registerAppIpc } from './registerAppIpc';

const { handle, removeHandler } = vi.hoisted(() => ({
  handle:
    vi.fn<
      (
        channel: string,
        listener: (event: unknown, ...args: unknown[]) => unknown,
      ) => void
    >(),
  removeHandler: vi.fn(),
}));
vi.mock('electron', () => ({ ipcMain: { handle, removeHandler } }));

describe('main IPC authorization and lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  function setup(url = 'file:///app/dist/renderer/index.html') {
    const frame = { url };
    const window = {
      isDestroyed: vi.fn(() => false),
      webContents: { mainFrame: frame },
      once: vi.fn<(event: string, listener: () => void) => void>(),
    };
    // Only the BrowserWindow surface used by this handler is simulated here.
    registerAppIpc(window as unknown as BrowserWindow, url);
    const listener = handle.mock.calls.at(-1)?.[1];
    if (!listener) throw new Error('IPC handler was not registered');
    const event = { sender: window.webContents, senderFrame: frame };
    return { window, frame, event, listener };
  }

  it.each(['file:///app/dist/renderer/index.html', 'http://127.0.0.1:5173/'])(
    'allows only the registered top-level renderer at %s',
    (url) => {
      const { listener, event } = setup(url);
      expect(handle.mock.calls.map(([channel]) => channel)).toEqual([
        APP_STATUS_CHANNEL,
      ]);
      expect(listener(event, { version: 1 })).toEqual({
        version: 1,
        ok: true,
        status: APP_STATUS,
      });
    },
  );

  it('rejects another window, same-URL subframes, and missing frames', () => {
    const { event, listener, frame } = setup();
    for (const foreign of [
      { ...event, sender: { mainFrame: frame } },
      { ...event, senderFrame: { url: frame.url } },
      { ...event, senderFrame: null },
    ]) {
      expect(listener(foreign, { version: 1 })).toEqual(
        ipcFailure('FORBIDDEN'),
      );
    }
  });

  it.each([
    'https://example.com/',
    'file:///app/dist/renderer/other.html',
    'file:///app/dist/renderer/index.html?extra=1',
    'http://127.0.0.1:5173/other',
  ])('rejects navigation away from the exact authorized URL: %s', (url) => {
    const { event, frame, listener } = setup();
    frame.url = url;
    expect(listener(event, { version: 1 })).toEqual(ipcFailure('FORBIDDEN'));
  });

  it('validates argument count and schema, without echoing payloads', () => {
    const { event, listener } = setup();
    for (const args of [
      [],
      [null],
      [{ version: 1 }, 'extra'],
      [{ version: 1, secret: 'fake-secret' }],
    ]) {
      expect(listener(event, ...args)).toEqual(ipcFailure('INVALID_REQUEST'));
    }
    expect(listener(event, { version: 99 })).toEqual(
      ipcFailure('UNSUPPORTED_VERSION'),
    );
  });

  it('rejects destroyed windows and removes the handler on close for recreation', () => {
    const { window, event, listener } = setup();
    window.isDestroyed.mockReturnValue(true);
    expect(listener(event, { version: 1 })).toEqual(ipcFailure('FORBIDDEN'));
    expect(window.once.mock.calls[0]?.[0]).toBe('closed');
    const close = window.once.mock.calls[0]?.[1];
    if (!close) throw new Error('No close cleanup');
    close();
    expect(removeHandler).toHaveBeenCalledExactlyOnceWith(APP_STATUS_CHANNEL);
    const recreated = setup();
    expect(recreated.listener(recreated.event, { version: 1 })).toEqual({
      version: 1,
      ok: true,
      status: APP_STATUS,
    });
  });
});
