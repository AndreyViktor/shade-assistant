import { describe, expect, it, vi } from 'vitest';
import { createGlobalShortcuts } from './globalShortcuts';
import { DEFAULT_SHORTCUTS } from '../../contracts/shortcuts/configuration';

function setup() {
  const callbacks = new Map<string, () => void>();
  const register = vi.fn((key: string, callback: () => void) => {
    if (callbacks.has(key)) return false;
    callbacks.set(key, callback);
    return true;
  });
  const unregister = vi.fn((key: string) => {
    callbacks.delete(key);
  });
  const dispatch = vi.fn();
  const shortcuts = createGlobalShortcuts({ register, unregister }, dispatch);
  return { callbacks, register, shortcuts, dispatch };
}

describe('global shortcuts', () => {
  it('registers, dispatches and releases every action', () => {
    const { callbacks, shortcuts, dispatch } = setup();
    expect(shortcuts.apply(DEFAULT_SHORTCUTS)).toBe(true);
    callbacks.get(DEFAULT_SHORTCUTS.help)?.();
    expect(dispatch).toHaveBeenCalledWith('help');
    shortcuts.clear();
    expect(callbacks.size).toBe(0);
  });

  it('rejects duplicate and text-compatible shortcuts without changing active ones', () => {
    const { shortcuts } = setup();
    shortcuts.apply(DEFAULT_SHORTCUTS);
    expect(
      shortcuts.apply({ ...DEFAULT_SHORTCUTS, help: DEFAULT_SHORTCUTS.stop }),
    ).toBe(false);
    expect(shortcuts.apply({ ...DEFAULT_SHORTCUTS, help: 'A' })).toBe(false);
    expect(shortcuts.snapshot()).toEqual(DEFAULT_SHORTCUTS);
  });

  it('restores the previous configuration when the OS refuses a new registration', () => {
    const { shortcuts, register } = setup();
    shortcuts.apply(DEFAULT_SHORTCUTS);
    register.mockReturnValueOnce(false);
    expect(
      shortcuts.apply({
        ...DEFAULT_SHORTCUTS,
        help: 'CommandOrControl+Alt+Shift+F8',
      }),
    ).toBe(false);
    expect(shortcuts.snapshot()).toEqual(DEFAULT_SHORTCUTS);
  });
});
