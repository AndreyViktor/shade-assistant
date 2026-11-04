// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindowConstructorOptions } from 'electron';
import { createMainWindow } from './createMainWindow';

const mocks = vi.hoisted(() => ({
  options: vi.fn<(options: BrowserWindowConstructorOptions) => void>(),
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  handle: vi.fn(),
  permissionRequest: vi.fn(),
  permissionCheck: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => '/unused' },
  safeStorage: {},
  dialog: {},
  ipcMain: { handle: mocks.handle, removeHandler: vi.fn() },
  session: {
    fromPartition: () => ({
      setPermissionRequestHandler: mocks.permissionRequest,
      setPermissionCheckHandler: mocks.permissionCheck,
    }),
  },
  BrowserWindow: class {
    constructor(options: BrowserWindowConstructorOptions) {
      mocks.options(options);
    }
    webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn() };
    once = vi.fn();
    loadURL = mocks.loadURL;
    loadFile = mocks.loadFile;
  },
}));

describe('secure window composition', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads a local preload and registers IPC before loading the renderer', async () => {
    await createMainWindow();
    expect(mocks.options).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 440,
        height: 640,
        minWidth: 360,
        minHeight: 400,
        alwaysOnTop: true,
      }),
    );
    const preferences = mocks.options.mock.calls[0]?.[0].webPreferences;
    expect(preferences?.preload).toMatch(/\/preload\/index\.js$/);
    expect(preferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    });
    expect(mocks.loadURL).not.toHaveBeenCalled();
    expect(mocks.loadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/renderer\/index\.html$/),
    );
    expect(mocks.handle.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.loadFile.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
