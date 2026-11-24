import { expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../shortcuts/configuration';
import { parseShortcutRequest, parseShortcutResult } from './shortcuts';

it('validates versioned requests and rejects duplicate, printable or extra shortcuts', () => {
  expect(
    parseShortcutRequest({
      version: 1,
      action: 'save',
      shortcuts: DEFAULT_SHORTCUTS,
    }),
  ).not.toBeNull();
  expect(parseShortcutRequest({ version: 2, action: 'read' })).toBeNull();
  expect(
    parseShortcutRequest({
      version: 1,
      action: 'save',
      shortcuts: { ...DEFAULT_SHORTCUTS, help: 'A' },
    }),
  ).toBeNull();
  expect(
    parseShortcutRequest({
      version: 1,
      action: 'save',
      shortcuts: { ...DEFAULT_SHORTCUTS, help: DEFAULT_SHORTCUTS.stop },
    }),
  ).toBeNull();
  expect(
    parseShortcutRequest({
      version: 1,
      action: 'save',
      shortcuts: { ...DEFAULT_SHORTCUTS, extra: 'A' },
    }),
  ).toBeNull();
  expect(parseShortcutResult({ version: 99, ok: true })).toEqual({
    version: 1,
    ok: false,
    code: 'UNAVAILABLE',
  });
});
