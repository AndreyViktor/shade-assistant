import { hasExactKeys } from '../validation';
import { parseShortcuts } from '../shortcuts/configuration';
import type { ShortcutConfiguration } from '../shortcuts/configuration';

export const SHORTCUTS_CHANNEL = 'meeting-copilot:shortcuts';
export type ShortcutRequest =
  | { version: 1; action: 'read' }
  | { version: 1; action: 'restore' }
  | { version: 1; action: 'editing'; editing: boolean }
  | { version: 1; action: 'save'; shortcuts: ShortcutConfiguration };
export type ShortcutResult =
  | {
      version: 1;
      ok: true;
      shortcuts: ShortcutConfiguration;
      registered: boolean;
    }
  | {
      version: 1;
      ok: false;
      code: 'INVALID_REQUEST' | 'FORBIDDEN' | 'UNAVAILABLE' | 'CONFLICT';
    };
export function parseShortcutRequest(value: unknown): ShortcutRequest | null {
  if (
    hasExactKeys(value, ['version', 'action']) &&
    value.version === 1 &&
    (value.action === 'read' || value.action === 'restore')
  )
    return { version: 1, action: value.action };
  if (
    hasExactKeys(value, ['version', 'action', 'editing']) &&
    value.version === 1 &&
    value.action === 'editing' &&
    typeof value.editing === 'boolean'
  )
    return { version: 1, action: 'editing', editing: value.editing };
  if (
    hasExactKeys(value, ['version', 'action', 'shortcuts']) &&
    value.version === 1 &&
    value.action === 'save'
  ) {
    const shortcuts = parseShortcuts(value.shortcuts);
    if (shortcuts) return { version: 1, action: 'save', shortcuts };
  }
  return null;
}
export function parseShortcutResult(value: unknown): ShortcutResult {
  if (
    hasExactKeys(value, ['version', 'ok', 'shortcuts', 'registered']) &&
    value.version === 1 &&
    value.ok === true &&
    typeof value.registered === 'boolean'
  ) {
    const shortcuts = parseShortcuts(value.shortcuts);
    if (shortcuts)
      return { version: 1, ok: true, shortcuts, registered: value.registered };
  }
  if (
    hasExactKeys(value, ['version', 'ok', 'code']) &&
    value.version === 1 &&
    value.ok === false &&
    (value.code === 'INVALID_REQUEST' ||
      value.code === 'FORBIDDEN' ||
      value.code === 'UNAVAILABLE' ||
      value.code === 'CONFLICT')
  )
    return { version: 1, ok: false, code: value.code };
  return { version: 1, ok: false, code: 'UNAVAILABLE' };
}
