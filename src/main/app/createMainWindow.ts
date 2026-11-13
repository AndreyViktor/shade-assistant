import { OpenAISuggestionProvider } from '../../infrastructure/ai/OpenAISuggestionProvider';
import { registerSessionIpc } from '../ipc/registerSessionIpc';
import { createSettingsService } from '../settings/createSettingsService';
import { registerSettingsIpc } from '../ipc/registerSettingsIpc';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, session, systemPreferences } from 'electron';
import { getDevelopmentUrl } from './getDevelopmentUrl';
import { registerAppIpc } from '../ipc/registerAppIpc';
import { createAppleNativeTranscriptionProvider } from '../transcription/createAppleNativeTranscriptionProvider';

export async function createMainWindow(): Promise<BrowserWindow> {
  const developmentUrl = getDevelopmentUrl(
    app.isPackaged,
    process.env.ELECTRON_RENDERER_URL,
  );
  const windowSession = session.fromPartition('meeting-copilot');

  const rendererFile = join(__dirname, '../renderer/index.html');

  // Capture stays native; renderer permissions remain denied, including in DEMO.
  windowSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  windowSession.setPermissionCheckHandler(() => false);

  const window = new BrowserWindow({
    title: 'Meeting Copilot',
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    alwaysOnTop: true,
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

  // Configure once before showing; repeating this can briefly hide the Dock/window.
  if (process.platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  const settings = createSettingsService(window);
  registerSessionIpc(
    window,
    developmentUrl ?? pathToFileURL(rendererFile).href,
    {
      createSuggestionProvider: (authorization, isAuthorized) =>
        new OpenAISuggestionProvider({
          model: authorization.model,
          getApiKey: () => settings.getApiKey(),
          isAuthorized,
        }),
      platform: process.platform,
      requestMicrophoneAccess: () =>
        systemPreferences.askForMediaAccess('microphone'),
      createAppleProvider: createAppleNativeTranscriptionProvider,
    },
  );
  registerAppIpc(window, developmentUrl ?? pathToFileURL(rendererFile).href);

  registerSettingsIpc(
    window,
    developmentUrl ?? pathToFileURL(rendererFile).href,
    settings,
  );

  if (developmentUrl) await window.loadURL(developmentUrl);
  else await window.loadFile(rendererFile);

  return window;
}
