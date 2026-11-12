// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsService } from './createSettingsService';
import { defaultPreferences } from '../../contracts/settings/preferences';

const mocks = vi.hoisted(() => ({
  directory: '',
  isPackaged: true,
  dialog: vi.fn(),
  encrypt: vi.fn().mockResolvedValue(Buffer.from('test-ciphertext')),
}));
vi.mock('electron', () => ({
  app: {
    getPath: () => mocks.directory,
    getAppPath: () => mocks.directory,
    get isPackaged() {
      return mocks.isPackaged;
    },
  },
  dialog: { showOpenDialog: mocks.dialog },
  safeStorage: {
    isAsyncEncryptionAvailable: () => Promise.resolve(true),
    encryptStringAsync: mocks.encrypt,
  },
}));

beforeEach(async () => {
  mocks.directory = await mkdtemp(join(tmpdir(), 'copilot-service-'));
  mocks.isPackaged = true;
  vi.clearAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'synthetic-env-key');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(mocks.directory, { recursive: true, force: true });
});

function setup() {
  const window = { isDestroyed: vi.fn(() => false) };
  const service = createSettingsService(window as unknown as BrowserWindow);
  return { service, window };
}

describe('settings composition', () => {
  it('loads .env only in development, exposes metadata and does not export secrets', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await writeFile(
      join(mocks.directory, '.env'),
      'OPENAI_API_KEY="synthetic-file-key" # comment\n',
    );
    expect(await setup().service.getApiKey()).toBeNull();
    mocks.isPackaged = false;
    const { service } = setup();
    expect(await service.getApiKey()).toBe('synthetic-file-key');
    const snapshot = await service.execute({ version: 1, action: 'read' });
    expect(snapshot.credential).toBe('development');
    expect(JSON.stringify(snapshot)).not.toContain('synthetic-file-key');
    expect(process.env.OPENAI_API_KEY).toBe('');
    expect(mocks.encrypt).not.toHaveBeenCalled();
  });
  it('prefers an exported key to .env and captures it until restart', async () => {
    mocks.isPackaged = false;
    await writeFile(
      join(mocks.directory, '.env'),
      'OPENAI_API_KEY=synthetic-file-key\n',
    );
    const { service } = setup();
    vi.stubEnv('OPENAI_API_KEY', 'changed-after-start');
    expect(await service.getApiKey()).toBe('synthetic-env-key');
  });
  it.each([
    '',
    'OPENAI_API_KEY=',
    'OPENAI_API_KEY="invalid key"',
    'x'.repeat(16385),
  ])(
    'ignores unusable .env without breaking settings (%#)',
    async (content) => {
      mocks.isPackaged = false;
      vi.stubEnv('OPENAI_API_KEY', '');
      await writeFile(join(mocks.directory, '.env'), content);
      const { service } = setup();
      expect(await service.getApiKey()).toBeNull();
      expect(
        (await service.execute({ version: 1, action: 'read' })).credential,
      ).toBe('missing');
    },
  );
  it('keeps local settings available when .env is absent', async () => {
    mocks.isPackaged = false;
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(await setup().service.getApiKey()).toBeNull();
  });
  it('ignores environment credentials in packaged builds and exposes only metadata in development', async () => {
    expect(
      (await setup().service.execute({ version: 1, action: 'read' }))
        .credential,
    ).toBe('missing');
    mocks.isPackaged = false;
    const value = await setup().service.execute({ version: 1, action: 'read' });
    expect(value.credential).toBe('development');
    expect(JSON.stringify(value)).not.toContain('synthetic-env-key');
  });
  it('persists preferences across service recreation without starting any provider', async () => {
    const preferences = {
      ...defaultPreferences('darwin'),
      mode: 'real' as const,
      language: 'en-US' as const,
    };
    await setup().service.execute({ version: 1, action: 'save', preferences });
    expect(
      (await setup().service.execute({ version: 1, action: 'read' }))
        .preferences,
    ).toEqual(preferences);
    expect(mocks.dialog).not.toHaveBeenCalled();
    expect(mocks.encrypt).not.toHaveBeenCalled();
  });
  it('cancelling import or closing its parent leaves storage unchanged', async () => {
    mocks.dialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const { service, window } = setup();
    expect(
      (await service.execute({ version: 1, action: 'import-secret' }))
        .credential,
    ).toBe('missing');
    mocks.dialog.mockResolvedValue({ canceled: false, filePaths: ['/unused'] });
    window.isDestroyed.mockReturnValue(true);
    expect(
      (await service.execute({ version: 1, action: 'import-secret' }))
        .credential,
    ).toBe('missing');
    expect(mocks.encrypt).not.toHaveBeenCalled();
  });
  it('rejects concurrent actions while a native dialog is open, then releases the lock', async () => {
    let finish: (value: unknown) => void = () => {
      throw new Error('not started');
    };
    mocks.dialog.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { service } = setup();
    const importing = service.execute({ version: 1, action: 'import-secret' });
    await expect(
      service.execute({ version: 1, action: 'remove-secret' }),
    ).rejects.toThrow('SETTINGS_BUSY');
    finish({ canceled: true, filePaths: [] });
    await importing;
    expect(
      (await service.execute({ version: 1, action: 'read' })).credential,
    ).toBe('missing');
  });
  it.skipIf(process.platform !== 'darwin')(
    'imports only through the native selection and returns no plaintext or path',
    async () => {
      const path = join(mocks.directory, 'input-key');
      await writeFile(path, 'synthetic-import-key\n');
      mocks.dialog.mockResolvedValue({ canceled: false, filePaths: [path] });
      const { service } = setup();
      const result = await service.execute({
        version: 1,
        action: 'import-secret',
      });
      expect(result.credential).toBe('stored');
      expect(JSON.stringify(result)).not.toMatch(
        /synthetic-import-key|input-key|test-ciphertext/,
      );
      expect(
        await readFile(join(mocks.directory, 'openai-key.enc'), 'utf8'),
      ).toBe('test-ciphertext');
      expect(await readFile(path, 'utf8')).toBe('synthetic-import-key\n');
      expect(
        (await service.execute({ version: 1, action: 'remove-secret' }))
          .credential,
      ).toBe('missing');
    },
  );
  it('rejects oversized files and allows later requests after failure', async () => {
    const path = join(mocks.directory, 'oversize');
    await writeFile(path, 'x'.repeat(4097));
    mocks.dialog.mockResolvedValue({ canceled: false, filePaths: [path] });
    const { service } = setup();
    await expect(
      service.execute({ version: 1, action: 'import-secret' }),
    ).rejects.toThrow('INVALID_FILE');
    expect(mocks.encrypt).not.toHaveBeenCalled();
    expect(
      (await service.execute({ version: 1, action: 'read' })).credential,
    ).toBe('missing');
  });
});

it('resolves a synthetic development credential only through the main-only method', async () => {
  mocks.isPackaged = false;
  const { service } = setup();
  expect(await service.getApiKey()).toBe('synthetic-env-key');
  expect(
    JSON.stringify(await service.execute({ version: 1, action: 'read' })),
  ).not.toContain('synthetic-env-key');
  mocks.isPackaged = true;
  expect(await setup().service.getApiKey()).toBeNull();
});
