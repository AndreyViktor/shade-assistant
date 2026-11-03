import {
  defaultPreferences,
  parsePreferences,
} from '../../contracts/settings/preferences';
import type { Preferences } from '../../contracts/settings/preferences';
import {
  failStorage,
  isMissingFile,
  readBoundedFile,
  writePrivateFile,
} from './privateFile';

export class PreferencesStore {
  constructor(
    private readonly path: string,
    private readonly platform: string,
  ) {}

  async read(): Promise<Preferences> {
    try {
      const value: unknown = JSON.parse(
        (await readBoundedFile(this.path, 4096)).toString('utf8'),
      );
      const preferences = parsePreferences(value);
      if (!preferences) throw new Error('INVALID_PREFERENCES');
      return preferences;
    } catch (error) {
      if (isMissingFile(error)) return defaultPreferences(this.platform);
      return failStorage('PREFERENCES_UNAVAILABLE');
    }
  }

  async save(value: Preferences): Promise<void> {
    const preferences = parsePreferences(value);
    if (!preferences) throw new Error('INVALID_PREFERENCES');
    try {
      await writePrivateFile(this.path, JSON.stringify(preferences));
    } catch {
      return failStorage('PREFERENCES_UNAVAILABLE');
    }
  }
}
