import { app, globalShortcut, ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { join } from 'node:path';
import {
  SHORTCUTS_CHANNEL,
  parseShortcutRequest,
} from '../../contracts/ipc/shortcuts';
import type { ShortcutResult } from '../../contracts/ipc/shortcuts';
import {
  DEFAULT_SHORTCUTS,
  parseShortcuts,
} from '../../contracts/shortcuts/configuration';
import type {
  ShortcutAction,
  ShortcutConfiguration,
} from '../../contracts/shortcuts/configuration';
import {
  isMissingFile,
  readBoundedFile,
  writePrivateFile,
} from '../../infrastructure/settings/privateFile';
import { isAuthorizedRenderer } from '../ipc/isAuthorizedRenderer';
import { createGlobalShortcuts } from './globalShortcuts';

export async function registerGlobalShortcuts(
  window: BrowserWindow,
  rendererUrl: string,
  dispatch: (action: ShortcutAction) => void,
): Promise<void> {
  const path = join(app.getPath('userData'), 'shortcuts.v1.json');
  const registry = createGlobalShortcuts(globalShortcut, dispatch);
  let current: ShortcutConfiguration = { ...DEFAULT_SHORTCUTS };
  let storageValid = true;
  try {
    const parsed = parseShortcuts(
      JSON.parse(
        (await readBoundedFile(path, 4096)).toString('utf8'),
      ) as unknown,
    );
    if (!parsed) throw new Error('INVALID_SHORTCUTS');
    current = parsed;
  } catch (error) {
    if (!isMissingFile(error)) {
      // Invalid storage must not cause unconfirmed shortcuts to be registered.
      storageValid = false;
    }
  }
  if (window.isDestroyed()) return;
  if (storageValid) registry.apply(current);
  let busy = false;
  let editing = false;
  ipcMain.handle(
    SHORTCUTS_CHANNEL,
    async (event, ...args: unknown[]): Promise<ShortcutResult> => {
      const fail = (
        code: 'INVALID_REQUEST' | 'FORBIDDEN' | 'UNAVAILABLE' | 'CONFLICT',
      ): ShortcutResult => ({ version: 1, ok: false, code });
      if (!isAuthorizedRenderer(window, rendererUrl, event))
        return fail('FORBIDDEN');
      const request = args.length === 1 ? parseShortcutRequest(args[0]) : null;
      if (!request) return fail('INVALID_REQUEST');
      if (request.action === 'editing') {
        if (editing === request.editing)
          return {
            version: 1,
            ok: true,
            shortcuts: current,
            registered: Object.keys(registry.snapshot()).length === 4,
          };
        editing = request.editing;
        if (editing) registry.clear();
        else if (!busy && storageValid) registry.apply(current);
        return {
          version: 1,
          ok: true,
          shortcuts: current,
          registered: Object.keys(registry.snapshot()).length === 4,
        };
      }
      if (busy) return fail('UNAVAILABLE');
      if (editing && request.action !== 'read') return fail('UNAVAILABLE');
      busy = true;
      try {
        if (request.action !== 'read') {
          const next =
            request.action === 'restore'
              ? { ...DEFAULT_SHORTCUTS }
              : request.shortcuts;
          if (!registry.apply(next)) return fail('CONFLICT');
          try {
            await writePrivateFile(path, JSON.stringify(next));
          } catch {
            if (!window.isDestroyed()) registry.apply(current);
            return fail('UNAVAILABLE');
          }
          current = next;
          storageValid = true;
        }
        if (!isAuthorizedRenderer(window, rendererUrl, event))
          return fail('FORBIDDEN');
        return {
          version: 1,
          ok: true,
          shortcuts: current,
          registered: Object.keys(registry.snapshot()).length === 4,
        };
      } finally {
        busy = false;
        if (editing) registry.clear();
        else if (
          !window.isDestroyed() &&
          storageValid &&
          Object.keys(registry.snapshot()).length !== 4
        )
          registry.apply(current);
      }
    },
  );
  window.once('closed', () => {
    registry.clear();
    ipcMain.removeHandler(SHORTCUTS_CHANNEL);
  });
}
