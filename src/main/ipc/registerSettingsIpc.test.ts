// @vitest-environment node
import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPreferences } from '../../contracts/settings/preferences';
import { SETTINGS_CHANNEL } from '../../contracts/ipc/settings';
import { registerSettingsIpc } from './registerSettingsIpc';

const { handle, removeHandler } = vi.hoisted(() => ({
  handle:
    vi.fn<
      (
        channel: string,
        listener: (event: unknown, ...args: unknown[]) => Promise<unknown>,
      ) => void
    >(),
  removeHandler: vi.fn(),
}));
vi.mock('electron', () => ({ ipcMain: { handle, removeHandler } }));
beforeEach(() => vi.clearAllMocks());

function setup() {
  const frame = { url: 'file:///app/index.html' };
  const window = {
    isDestroyed: vi.fn(() => false),
    webContents: { mainFrame: frame },
    once: vi.fn<(event: string, listener: () => void) => void>(),
  };
  const snapshot = {
    preferences: defaultPreferences('darwin'),
    credential: 'missing' as const,
  };
  const execute = vi.fn().mockResolvedValue(snapshot);
  registerSettingsIpc(window as unknown as BrowserWindow, frame.url, {
    execute,
  });
  const listener = handle.mock.calls[0]?.[1];
  if (!listener) throw new Error('missing handler');
  return {
    listener,
    window,
    frame,
    execute,
    snapshot,
    event: { sender: window.webContents, senderFrame: frame },
  };
}

describe('settings IPC', () => {
  it('allows a validated save only from the exact window, frame and URL', async () => {
    const { listener, event, execute, snapshot } = setup();
    const request = {
      version: 1,
      action: 'save',
      preferences: snapshot.preferences,
    };
    expect(await listener(event, request)).toEqual({
      version: 1,
      ok: true,
      settings: snapshot,
    });
    expect(execute).toHaveBeenCalledExactlyOnceWith(request);
  });
  it('denies foreign windows, child frames, navigation and destroyed windows before storage access', async () => {
    const { listener, event, frame, execute, window } = setup();
    for (const foreign of [
      { ...event, sender: {} },
      { ...event, senderFrame: { ...frame } },
      { ...event, senderFrame: null },
    ]) {
      expect(
        await listener(foreign, { version: 1, action: 'read' }),
      ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    }
    frame.url += '?extra';
    expect(await listener(event, { version: 1, action: 'read' })).toMatchObject(
      { code: 'FORBIDDEN' },
    );
    window.isDestroyed.mockReturnValue(true);
    expect(await listener(event, { version: 1, action: 'read' })).toMatchObject(
      { code: 'FORBIDDEN' },
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects arbitrary actions, secrets, paths, versions, extra arguments and remote opt-in bypass', async () => {
    const { listener, event, execute, snapshot } = setup();
    for (const args of [
      [],
      [null],
      [{ version: 2, action: 'read' }],
      [{ version: 1, action: 'read' }, 1],
      [{ version: 1, action: 'import-secret', path: '/key' }],
      [{ version: 1, action: 'set-secret', secret: 'synthetic' }],
      [
        {
          version: 1,
          action: 'save',
          preferences: { ...snapshot.preferences, sttProvider: 'openai-stt' },
        },
      ],
    ]) {
      expect(await listener(event, ...args)).toMatchObject({
        ok: false,
        code: 'INVALID_REQUEST',
      });
    }
    expect(execute).not.toHaveBeenCalled();
  });
  it('redacts internal errors, rechecks authorization after await and unregisters on close', async () => {
    const { listener, event, execute, window, snapshot } = setup();
    execute.mockRejectedValueOnce(new Error('synthetic-secret /private/path'));
    expect(await listener(event, { version: 1, action: 'read' })).toEqual({
      version: 1,
      ok: false,
      code: 'UNAVAILABLE',
    });
    execute.mockImplementationOnce(() => {
      window.isDestroyed.mockReturnValue(true);
      return Promise.resolve(snapshot);
    });
    expect(await listener(event, { version: 1, action: 'read' })).toMatchObject(
      { code: 'FORBIDDEN' },
    );
    window.once.mock.calls[0]?.[1]();
    expect(removeHandler).toHaveBeenCalledExactlyOnceWith(SETTINGS_CHANNEL);
  });
});
