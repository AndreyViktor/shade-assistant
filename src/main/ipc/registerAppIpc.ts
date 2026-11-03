import { isAuthorizedRenderer } from './isAuthorizedRenderer';
import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import {
  APP_STATUS,
  APP_STATUS_CHANNEL,
  IPC_VERSION,
  ipcFailure,
  validateStatusRequest,
} from '../../contracts/ipc/appStatus';
import type { AppStatusResult } from '../../contracts/ipc/appStatus';

export function registerAppIpc(
  window: BrowserWindow,
  rendererUrl: string,
): void {
  ipcMain.handle(
    APP_STATUS_CHANNEL,
    (event, ...args: unknown[]): AppStatusResult => {
      // A matching URL alone does not authorize another window or a child frame.
      if (!isAuthorizedRenderer(window, rendererUrl, event)) {
        return ipcFailure('FORBIDDEN');
      }
      if (args.length !== 1) return ipcFailure('INVALID_REQUEST');
      const error = validateStatusRequest(args[0]);
      if (error) return ipcFailure(error);
      return { version: IPC_VERSION, ok: true, status: { ...APP_STATUS } };
    },
  );
  window.once('closed', () => ipcMain.removeHandler(APP_STATUS_CHANNEL));
}
