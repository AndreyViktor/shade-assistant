import { createSettingsService } from '../settings/createSettingsService';
import { registerSettingsIpc } from '../ipc/registerSettingsIpc';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, session } from 'electron';
import { getDevelopmentUrl } from './getDevelopmentUrl';
import { registerAppIpc } from '../ipc/registerAppIpc';

export async function createMainWindow(): Promise<BrowserWindow> {
  const developmentUrl = getDevelopmentUrl(
    app.isPackaged,
    process.env.ELECTRON_RENDERER_URL,
  );
  const windowSession = session.fromPartition('meeting-copilot');

  const rendererFile = join(__dirname, '../renderer/index.html');

  // Capture permissions remain denied until the explicit flow in T008.
  windowSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  windowSession.setPermissionCheckHandler(() => false);

  const window = new BrowserWindow({
    title: 'Meeting Copilot',
    width: 880,
    height: 620,
    minWidth: 480,
    minHeight: 420,
    show: false,
    backgroundColor: '#101827',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      session: windowSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  registerAppIpc(window, developmentUrl ?? pathToFileURL(rendererFile).href);

  registerSettingsIpc(
    window,
    developmentUrl ?? pathToFileURL(rendererFile).href,
    createSettingsService(window),
  );

  if (developmentUrl) await window.loadURL(developmentUrl);
  else await window.loadFile(rendererFile);

  return window;
}
