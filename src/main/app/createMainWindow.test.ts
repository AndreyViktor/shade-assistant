// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindowConstructorOptions } from 'electron';
import { createMainWindow } from './createMainWindow';

type PermissionRequestHandler = (
  contents: unknown,
  permission: string,
  callback: (allowed: boolean) => void,
  details: unknown,
) => void;
type NavigationListener = (event: { preventDefault(): void }) => void;

const mocks = vi.hoisted(() => ({
  workspaces: vi.fn(),
  options: vi.fn<(options: BrowserWindowConstructorOptions) => void>(),
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  handle: vi.fn(),
  permissionRequest: vi.fn<(handler: PermissionRequestHandler) => void>(),
  permissionCheck: vi.fn<(handler: () => boolean) => void>(),
  requestMicrophoneAccess: vi.fn(),
  windowOpen:
    vi.fn<(handler: (details: unknown) => { action: 'deny' }) => void>(),
  webContentsOn: vi.fn<(event: string, listener: NavigationListener) => void>(),
}));

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: () => '/unused' },
  safeStorage: {},
  systemPreferences: { askForMediaAccess: mocks.requestMicrophoneAccess },
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
    webContents = {
      setWindowOpenHandler: mocks.windowOpen,
      on: mocks.webContentsOn,
    };
    once = vi.fn();
    setVisibleOnAllWorkspaces = mocks.workspaces;
    loadURL = mocks.loadURL;
    loadFile = mocks.loadFile;
  },
}));

describe('secure window composition', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it.each(['darwin', 'linux', 'win32'])(
    'configures Spaces only on macOS (%s)',
    async (platform) => {
      vi.stubGlobal('process', { ...process, platform });
      await createMainWindow();
      if (platform === 'darwin') {
        expect(mocks.workspaces).toHaveBeenCalledExactlyOnceWith(true, {
          visibleOnFullScreen: true,
        });
        expect(mocks.workspaces.mock.invocationCallOrder[0]).toBeLessThan(
          mocks.loadFile.mock.invocationCallOrder[0] ?? 0,
        );
      } else expect(mocks.workspaces).not.toHaveBeenCalled();
    },
  );

  it('loads a local preload and registers IPC before loading the renderer', async () => {
    await createMainWindow();
    expect(mocks.options).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 960,
        height: 720,
        minWidth: 640,
        minHeight: 480,
        alwaysOnTop: true,
      }),
    );
    const preferences = mocks.options.mock.calls[0]?.[0].webPreferences;
    expect(preferences?.preload).toMatch(/\/preload\/index\.js$/);
    expect(preferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      navigateOnDragDrop: false,
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

  it('denies renderer permissions, new windows, navigations and redirects', async () => {
    await createMainWindow();

    const permissionRequest = mocks.permissionRequest.mock.calls[0]?.[0];
    const permissionCheck = mocks.permissionCheck.mock.calls[0]?.[0];
    const permissionCallback = vi.fn();
    permissionRequest?.({}, 'media', permissionCallback, {});
    expect(permissionCallback).toHaveBeenCalledExactlyOnceWith(false);
    expect(permissionCheck?.()).toBe(false);

    const open = mocks.windowOpen.mock.calls[0]?.[0];
    expect(open?.({})).toEqual({ action: 'deny' });

    for (const eventName of ['will-navigate', 'will-redirect']) {
      const listener = mocks.webContentsOn.mock.calls.find(
        ([name]) => name === eventName,
      )?.[1];
      const event = { preventDefault: vi.fn() };
      listener?.(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }
  });
});
