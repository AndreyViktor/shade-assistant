import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import {
  SETTINGS_CHANNEL,
  parseSettingsRequest,
  settingsFailure,
} from '../../contracts/ipc/settings';
import type { SettingsResult } from '../../contracts/ipc/settings';
import type { SettingsService } from '../settings/createSettingsService';
import { isAuthorizedRenderer } from './isAuthorizedRenderer';

export function registerSettingsIpc(
  window: BrowserWindow,
  rendererUrl: string,
  service: SettingsService,
): void {
  ipcMain.handle(
    SETTINGS_CHANNEL,
    async (event, ...args: unknown[]): Promise<SettingsResult> => {
      if (!isAuthorizedRenderer(window, rendererUrl, event))
        return settingsFailure('FORBIDDEN');
      if (args.length !== 1) return settingsFailure('INVALID_REQUEST');
      const request = parseSettingsRequest(args[0]);
      if (!request) return settingsFailure('INVALID_REQUEST');
      try {
        const settings = await service.execute(request);
        if (!isAuthorizedRenderer(window, rendererUrl, event))
          return settingsFailure('FORBIDDEN');
        return { version: 1, ok: true, settings };
      } catch {
        return settingsFailure('UNAVAILABLE');
      }
    },
  );
  window.once('closed', () => ipcMain.removeHandler(SETTINGS_CHANNEL));
}
