import { join } from 'node:path';
import { app, dialog, safeStorage } from 'electron';
import type { BrowserWindow } from 'electron';
import type {
  SettingsRequest,
  SettingsSnapshot,
} from '../../contracts/ipc/settings';
import { PreferencesStore } from '../../infrastructure/settings/PreferencesStore';
import {
  SecretStore,
  isValidSecret,
} from '../../infrastructure/settings/SecretStore';
import { readBoundedFile } from '../../infrastructure/settings/privateFile';

export interface SettingsService {
  execute(request: SettingsRequest): Promise<SettingsSnapshot>;
}

export function createSettingsService(window: BrowserWindow): SettingsService {
  const directory = app.getPath('userData');
  const preferences = new PreferencesStore(
    join(directory, 'preferences.v1.json'),
    process.platform,
  );
  const secrets = new SecretStore(
    join(directory, 'openai-key.enc'),
    safeStorage,
    process.platform,
  );
  const developmentSecret =
    !app.isPackaged && isValidSecret(process.env.OPENAI_API_KEY);
  let busy = false;

  async function snapshot(): Promise<SettingsSnapshot> {
    return {
      preferences: await preferences.read(),
      credential: developmentSecret
        ? 'development'
        : (await secrets.has())
          ? 'stored'
          : 'missing',
    };
  }

  return {
    async execute(request) {
      // A pending native dialog must not allow overlapping mutations or imports.
      if (busy) throw new Error('SETTINGS_BUSY');
      busy = true;
      try {
        if (request.action === 'save')
          await preferences.save(request.preferences);
        if (request.action === 'remove-secret') await secrets.remove();
        if (request.action === 'import-secret') {
          const selection = await dialog.showOpenDialog(window, {
            title: 'Importar chave OpenAI',
            message:
              'Selecione um arquivo contendo somente a chave. O arquivo original não será removido. Nenhuma chamada à API será feita.',
            properties: ['openFile'],
          });
          const path = selection.filePaths[0];
          if (!selection.canceled && path && !window.isDestroyed()) {
            const value = (await readBoundedFile(path, 4096))
              .toString('utf8')
              .trim();
            await secrets.set(value);
          }
        }
        return await snapshot();
      } finally {
        busy = false;
      }
    },
  };
}
