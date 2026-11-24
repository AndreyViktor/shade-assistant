import {
  SHORTCUT_ACTIONS,
  parseShortcuts,
} from '../../contracts/shortcuts/configuration';
import type {
  ShortcutAction,
  ShortcutConfiguration,
} from '../../contracts/shortcuts/configuration';

export interface ShortcutRegistry {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
}

export function createGlobalShortcuts(
  registry: ShortcutRegistry,
  dispatch: (action: ShortcutAction) => void,
) {
  let active: Partial<ShortcutConfiguration> = {};
  function clear() {
    for (const value of Object.values(active)) registry.unregister(value);
    active = {};
  }
  function apply(configuration: ShortcutConfiguration): boolean {
    if (!parseShortcuts(configuration)) return false;
    const previous = { ...active };
    clear();
    try {
      for (const action of SHORTCUT_ACTIONS) {
        const accelerator = configuration[action];
        if (!registry.register(accelerator, () => dispatch(action)))
          throw new Error('SHORTCUT_UNAVAILABLE');
        active[action] = accelerator;
      }
      return true;
    } catch {
      clear();
      for (const action of SHORTCUT_ACTIONS) {
        const accelerator = previous[action];
        if (!accelerator) continue;
        try {
          if (registry.register(accelerator, () => dispatch(action)))
            active[action] = accelerator;
        } catch {
          // A competing application can claim an accelerator during rollback.
        }
      }
      return false;
    }
  }
  return { apply, clear, snapshot: () => ({ ...active }) };
}
