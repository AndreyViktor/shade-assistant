export const SHORTCUT_ACTIONS = ['window', 'pause', 'stop', 'help'] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];
export type ShortcutConfiguration = Record<ShortcutAction, string>;

export const DEFAULT_SHORTCUTS: ShortcutConfiguration = {
  window: 'CommandOrControl+Alt+Shift+F9',
  pause: 'CommandOrControl+Alt+Shift+F10',
  stop: 'CommandOrControl+Alt+Shift+F11',
  help: 'CommandOrControl+Alt+Shift+F12',
};

export function parseShortcuts(value: unknown): ShortcutConfiguration | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== SHORTCUT_ACTIONS.length) return null;
  const strings = SHORTCUT_ACTIONS.map((action) => data[action]);
  if (
    !strings.every(
      (entry) =>
        typeof entry === 'string' &&
        /^CommandOrControl\+Alt\+Shift\+F(?:[1-9]|1[0-2])$/.test(entry),
    )
  )
    return null;
  if (new Set(strings).size !== strings.length) return null;
  return {
    window: data.window as string,
    pause: data.pause as string,
    stop: data.stop as string,
    help: data.help as string,
  };
}
