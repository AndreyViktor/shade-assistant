import { hasExactKeys } from '../validation';
import { parsePreferences } from '../settings/preferences';
import type { Preferences } from '../settings/preferences';
import { parseStatusResult } from './appStatus';
import type { IpcErrorCode } from './appStatus';

export const SETTINGS_CHANNEL = 'meeting-copilot:settings';
export type SettingsRequest =
  | { version: 1; action: 'read' | 'import-secret' | 'remove-secret' }
  | { version: 1; action: 'save'; preferences: Preferences };
export type SettingsSnapshot = {
  preferences: Preferences;
  credential: 'missing' | 'stored' | 'development';
};
export type SettingsResult =
  | { version: 1; ok: true; settings: SettingsSnapshot }
  | { version: 1; ok: false; code: IpcErrorCode };

export function parseSettingsRequest(value: unknown): SettingsRequest | null {
  if (
    hasExactKeys(value, ['version', 'action']) &&
    value.version === 1 &&
    (value.action === 'read' ||
      value.action === 'import-secret' ||
      value.action === 'remove-secret')
  ) {
    return { version: 1, action: value.action };
  }
  if (
    hasExactKeys(value, ['version', 'action', 'preferences']) &&
    value.version === 1 &&
    value.action === 'save'
  ) {
    const preferences = parsePreferences(value.preferences);
    if (preferences) return { version: 1, action: 'save', preferences };
  }
  return null;
}

export function settingsFailure(code: IpcErrorCode): SettingsResult {
  return { version: 1, ok: false, code };
}

export function parseSettingsResult(value: unknown): SettingsResult {
  if (
    hasExactKeys(value, ['version', 'ok', 'settings']) &&
    value.version === 1 &&
    value.ok === true &&
    hasExactKeys(value.settings, ['preferences', 'credential'])
  ) {
    const preferences = parsePreferences(value.settings.preferences);
    const credential = value.settings.credential;
    if (
      preferences &&
      (credential === 'missing' ||
        credential === 'stored' ||
        credential === 'development')
    ) {
      return { version: 1, ok: true, settings: { preferences, credential } };
    }
  }
  const error = parseStatusResult(value);
  if (!error.ok) return error;
  return settingsFailure('INVALID_RESPONSE');
}
