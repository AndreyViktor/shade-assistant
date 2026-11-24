// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';
import { DEFAULT_SHORTCUTS } from '../../contracts/shortcuts/configuration';
import { registerGlobalShortcuts } from './registerGlobalShortcuts';

const mocks = vi.hoisted(() => ({
  directory: '',
  handle: vi.fn(),
  removeHandler: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { getPath: () => mocks.directory },
  globalShortcut: { register: mocks.register, unregister: mocks.unregister },
  ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler },
}));
let directory = '';
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
  vi.clearAllMocks();
});
it('persists confirmed changes, reloads them on restart and releases registrations on close', async () => {
  directory = await mkdtemp(join(tmpdir(), 't068-'));
  mocks.directory = directory;
  const keys = new Set<string>();
  mocks.register.mockImplementation((key: string) => {
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  mocks.unregister.mockImplementation((key: string) => keys.delete(key));
  const frame = { url: 'file:///test' };
  const close = vi.fn();
  const contents = { mainFrame: frame };
  const window = {
    isDestroyed: () => false,
    webContents: contents,
    once: close,
  } as unknown as BrowserWindow;
  await registerGlobalShortcuts(window, frame.url, vi.fn());
  const handler = mocks.handle.mock.calls[0]?.[1] as (
    event: unknown,
    request: unknown,
  ) => Promise<unknown>;
  const event = { sender: contents, senderFrame: frame };
  expect(
    await handler(
      { sender: {}, senderFrame: frame },
      { version: 1, action: 'read' },
    ),
  ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  expect(
    await handler(event, { version: 1, action: 'editing', editing: 'yes' }),
  ).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
  expect(
    await handler(event, { version: 1, action: 'editing', editing: true }),
  ).toMatchObject({ ok: true, registered: false });
  expect(keys.size).toBe(0);
  expect(
    await handler(event, { version: 1, action: 'editing', editing: false }),
  ).toMatchObject({ ok: true, registered: true });
  expect(keys.size).toBe(4);
  const next = { ...DEFAULT_SHORTCUTS, help: 'CommandOrControl+Alt+Shift+F8' };
  expect(
    await handler(event, { version: 1, action: 'save', shortcuts: next }),
  ).toMatchObject({ ok: true, registered: true });
  expect(
    JSON.parse(await readFile(join(directory, 'shortcuts.v1.json'), 'utf8')),
  ).toEqual(next);
  const closed = close.mock.calls.find(
    ([name]) => name === 'closed',
  )?.[1] as () => void;
  closed();
  expect(keys.size).toBe(0);
  await registerGlobalShortcuts(window, frame.url, vi.fn());
  expect(keys.has(next.help)).toBe(true);
  expect(keys.has(DEFAULT_SHORTCUTS.help)).toBe(false);
  closed();
});
