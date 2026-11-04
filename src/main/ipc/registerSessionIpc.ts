import { DemoPlayback } from '../../infrastructure/transcription/mock/DemoPlayback';
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
  const demo = new DemoPlayback(session);
  function stop() {
    session.stop();
    demo.stop();
  }
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
        if (accepted) demo.start();
      }
      if (request.action === 'pause') {
        accepted = session.pause();
        if (accepted) demo.pause();
      }
      if (request.action === 'resume') {
        accepted = session.resume();
        if (accepted) demo.resume();
      }
      if (request.action === 'stop') stop();
      return accepted
        ? {
            version: 1,
            ok: true,
            session: session.snapshot(),
            demo: demo.snapshot(),
          }
        : { version: 1, ok: false, code: 'INVALID_REQUEST' };
    },
  );
  // Reload/crash/close must not leave work authorized in an unattended renderer.
  window.webContents.on('did-start-loading', () => {
    if (session.snapshot().phase !== 'idle') stop();
  });
  window.webContents.on('render-process-gone', stop);
  window.once('closed', () => {
    stop();
    ipcMain.removeHandler(SESSION_CHANNEL);
  });
}
