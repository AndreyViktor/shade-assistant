import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import {
  SESSION_CHANNEL,
  parseSessionRequest,
} from '../../contracts/ipc/session';
import type { SessionResult } from '../../contracts/ipc/session';
import { MeetingSession } from '../../core/meeting/MeetingSession';
import { isAuthorizedRenderer } from './isAuthorizedRenderer';

export function registerSessionIpc(
  window: BrowserWindow,
  rendererUrl: string,
): void {
  const session = new MeetingSession();
  ipcMain.handle(
    SESSION_CHANNEL,
    (event, ...args: unknown[]): SessionResult => {
      if (!isAuthorizedRenderer(window, rendererUrl, event))
        return { version: 1, ok: false, code: 'FORBIDDEN' };
      const request = args.length === 1 ? parseSessionRequest(args[0]) : null;
      if (!request) return { version: 1, ok: false, code: 'INVALID_REQUEST' };
      let accepted = true;
      if (request.action === 'start') {
        // T014/T016 provide real adapters. Preferences/credentials are not consent.
        if (request.options.mode !== 'demo')
          return { version: 1, ok: false, code: 'UNAVAILABLE' };
        accepted = session.start(request.options);
      }
      if (request.action === 'pause') accepted = session.pause();
      if (request.action === 'resume') accepted = session.resume();
      if (request.action === 'stop') session.stop();
      return accepted
        ? { version: 1, ok: true, session: session.snapshot() }
        : { version: 1, ok: false, code: 'INVALID_REQUEST' };
    },
  );
  // Reload/crash/close must not leave work authorized in an unattended renderer.
  window.webContents.on('did-start-loading', () => {
    if (session.snapshot().phase !== 'idle') session.stop();
  });
  window.webContents.on('render-process-gone', () => session.stop());
  window.once('closed', () => {
    session.stop();
    ipcMain.removeHandler(SESSION_CHANNEL);
  });
}
