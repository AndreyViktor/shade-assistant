import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import {
  READINESS_CHANNEL,
  READINESS_IPC_VERSION,
  parseReadinessRequest,
  readinessFailure,
} from '../../contracts/ipc/readiness';
import type { ReadinessResult } from '../../contracts/ipc/readiness';
import type { ReadinessService } from '../readiness/createReadinessService';
import { isAuthorizedRenderer } from './isAuthorizedRenderer';

export function registerReadinessIpc(
  window: BrowserWindow,
  rendererUrl: string,
  service: ReadinessService,
): void {
  ipcMain.handle(
    READINESS_CHANNEL,
    async (event, ...args: unknown[]): Promise<ReadinessResult> => {
      if (!isAuthorizedRenderer(window, rendererUrl, event))
        return readinessFailure('FORBIDDEN');
      if (args.length !== 1) return readinessFailure('INVALID_REQUEST');
      const request = parseReadinessRequest(args[0]);
      if (!request) return readinessFailure('INVALID_REQUEST');
      try {
        if (request.action === 'check') {
          const readiness = await service.check();
          if (!isAuthorizedRenderer(window, rendererUrl, event))
            return readinessFailure('FORBIDDEN');
          return {
            version: READINESS_IPC_VERSION,
            ok: true,
            action: 'check',
            readiness,
          };
        }
        await service.openSettings(request.target);
        if (!isAuthorizedRenderer(window, rendererUrl, event))
          return readinessFailure('FORBIDDEN');
        return {
          version: READINESS_IPC_VERSION,
          ok: true,
          action: 'open-settings',
          target: request.target,
        };
      } catch {
        return readinessFailure('UNAVAILABLE');
      }
    },
  );
  window.once('closed', () => ipcMain.removeHandler(READINESS_CHANNEL));
}
