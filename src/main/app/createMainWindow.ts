import { join } from 'node:path';
import { app, BrowserWindow, session } from 'electron';
import { getDevelopmentUrl } from './getDevelopmentUrl';

export async function createMainWindow(): Promise<BrowserWindow> {
  const developmentUrl = getDevelopmentUrl(
    app.isPackaged,
    process.env.ELECTRON_RENDERER_URL,
  );
  const windowSession = session.fromPartition('meeting-copilot');

  // T001 has no capture capabilities. T003/T008 will introduce an explicit permission flow.
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

  if (developmentUrl) await window.loadURL(developmentUrl);
  else await window.loadFile(join(__dirname, '../renderer/index.html'));

  return window;
}
