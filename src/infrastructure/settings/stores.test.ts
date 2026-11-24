// @vitest-environment node
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPreferences } from '../../contracts/settings/preferences';
import { PreferencesStore } from './PreferencesStore';
import { SecretStore } from './SecretStore';
import { readBoundedFile } from './privateFile';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'copilot-settings-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('preferences on disk', () => {
  it('persists across instances with private file permissions and no temporary files', async () => {
    const path = join(directory, 'preferences.json');
    const store = new PreferencesStore(path, 'darwin');
    expect(await store.read()).toEqual(defaultPreferences('darwin'));
    const preferences = {
      ...defaultPreferences('darwin'),
      mode: 'real' as const,
      language: 'en-US' as const,
      audioSource: 'system' as const,
      suggestionModel: 'gpt-5.4' as const,
    };
    await store.save(preferences);
    expect(await new PreferencesStore(path, 'darwin').read()).toEqual(
      preferences,
    );
    if (process.platform !== 'win32')
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual(['preferences.json']);
  });
  it.each([
    '{',
    JSON.stringify({ ...defaultPreferences('darwin'), version: 6 }),
    'x'.repeat(4097),
  ])(
    'fails closed on corruption, newer versions or oversize without overwriting',
    async (contents) => {
      const path = join(directory, 'preferences.json');
      await writeFile(path, contents);
      await expect(new PreferencesStore(path, 'darwin').read()).rejects.toThrow(
        'PREFERENCES_UNAVAILABLE',
      );
      expect(await readFile(path, 'utf8')).toBe(contents);
    },
  );
  it.each(['pt-BR', 'en-US', 'pt-BR+en-US'])(
    'migrates legacy %s once, preserves mode/provider and never grants consent',
    async (language) => {
      const path = join(directory, 'preferences.v1.json');
      await writeFile(
        path,
        JSON.stringify({
          version: 1,
          mode: 'real',
          sttProvider: 'mock',
          language,
        }),
      );
      const expected = {
        ...defaultPreferences('darwin'),
        mode: 'real',
        sttProvider: 'mock',
        language: language === 'en-US' ? 'en-US' : 'pt-BR',
      };
      expect(await new PreferencesStore(path, 'darwin').read()).toEqual(
        expected,
      );
      const contents = await readFile(path, 'utf8');
      expect(JSON.parse(contents)).toEqual(expected);
      expect(await new PreferencesStore(path, 'darwin').read()).toEqual(
        expected,
      );
      expect(await readFile(path, 'utf8')).toBe(contents);
      expect(Object.keys(expected).sort()).toEqual(
        [
          'version',
          'audioSource',
          'mode',
          'sttProvider',
          'language',
          'suggestionProvider',
          'suggestionModel',
        ].sort(),
      );
    },
  );
  it.each(['apple-local', 'mock'])(
    'migrates v2 %s preserving all choices and adding both sources',
    async (sttProvider) => {
      const path = join(directory, 'preferences.v1.json');
      const legacy = {
        version: 2,
        mode: 'real',
        sttProvider,
        language: 'en-US',
        suggestionProvider: 'openai',
        suggestionModel: 'gpt-5.4',
      };
      await writeFile(path, JSON.stringify(legacy));
      const expected = {
        ...legacy,
        version: 5,
        audioSource: 'both',
      };
      expect(await new PreferencesStore(path, 'darwin').read()).toEqual(
        expected,
      );
      expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(expected);
      const firstWrite = await stat(path);
      expect(await new PreferencesStore(path, 'darwin').read()).toEqual(
        expected,
      );
      expect((await stat(path)).mtimeMs).toBe(firstWrite.mtimeMs);
      expect(firstWrite.mode & 0o777).toBe(0o600);
    },
  );
  it('migrates v3 to no profile once without retaining arbitrary context', async () => {
    const path = join(directory, 'preferences.v1.json');
    const legacy = {
      version: 3,
      audioSource: 'mic',
      mode: 'real',
      sttProvider: 'apple-local',
      language: 'pt-BR',
      suggestionProvider: 'openai',
      suggestionModel: 'gpt-5.4-mini',
    };
    await writeFile(path, JSON.stringify(legacy));
    const expected = { ...legacy, version: 5 };
    expect(await new PreferencesStore(path, 'darwin').read()).toEqual(expected);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(expected);
  });
  it.each([
    'none',
    'discovery',
    'status',
    'interview',
    'negotiation',
    'technical-review',
  ])(
    'migrates v4 %s without persisting the profile',
    async (meetingProfile) => {
      const path = join(directory, 'preferences.v1.json');
      const expected = {
        ...defaultPreferences('darwin'),
        audioSource: 'system',
        mode: 'real',
        language: 'en-US',
        suggestionModel: 'gpt-5.4',
      };
      await writeFile(
        path,
        JSON.stringify({ ...expected, version: 4, meetingProfile }),
      );
      expect(await new PreferencesStore(path, 'darwin').read()).toEqual(
        expected,
      );
      expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(expected);
    },
  );
  it('rejects malformed v4 without overwriting it', async () => {
    const path = join(directory, 'preferences.v1.json');
    const contents = JSON.stringify({
      ...defaultPreferences('darwin'),
      version: 4,
      meetingProfile: 'unknown',
    });
    await writeFile(path, contents);
    await expect(new PreferencesStore(path, 'darwin').read()).rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe(contents);
  });
  it.each([
    { audioSource: 'mic' },
    { consent: true },
    { secret: 'synthetic' },
    { suggestionModel: 'unknown' },
    { language: 'pt-BR+en-US' },
    { suggestionProvider: 'unknown' },
    { sttProvider: 'openai-stt' },
  ])('rejects invalid v2 without overwriting: %j', async (invalid) => {
    const path = join(directory, 'preferences.v1.json');
    const contents = JSON.stringify({
      version: 2,
      mode: 'real',
      sttProvider: 'apple-local',
      language: 'en-US',
      suggestionProvider: 'openai',
      suggestionModel: 'gpt-5.4',
      ...invalid,
    });
    await writeFile(path, contents);
    await expect(new PreferencesStore(path, 'darwin').read()).rejects.toThrow(
      'PREFERENCES_UNAVAILABLE',
    );
    expect(await readFile(path, 'utf8')).toBe(contents);
  });
  it.each([
    {
      version: 1,
      mode: 'real',
      sttProvider: 'apple-local',
      language: 'en-US',
      secret: 'synthetic',
    },
    { version: 1, mode: 'real', sttProvider: 'openai-stt', language: 'en-US' },
    {
      version: 1,
      mode: 'real',
      sttProvider: 'apple-local',
      language: 'unknown',
    },
  ])('preserves malformed legacy files without migrating', async (legacy) => {
    const path = join(directory, 'preferences.v1.json');
    const contents = JSON.stringify(legacy);
    await writeFile(path, contents);
    await expect(new PreferencesStore(path, 'darwin').read()).rejects.toThrow(
      'PREFERENCES_UNAVAILABLE',
    );
    expect(await readFile(path, 'utf8')).toBe(contents);
  });
  it('reports write failure without paths and does not overwrite an unrelated directory', async () => {
    await expect(
      new PreferencesStore(directory, 'darwin').save(
        defaultPreferences('darwin'),
      ),
    ).rejects.toThrow('PREFERENCES_UNAVAILABLE');
    expect(await readdir(directory)).toEqual([]);
  });
  it('bounds file reads and rejects directories', async () => {
    const path = join(directory, 'large');
    await writeFile(path, '12345');
    await expect(readBoundedFile(path, 4)).rejects.toThrow('INVALID_FILE');
    await expect(readBoundedFile(directory, 4)).rejects.toThrow('INVALID_FILE');
  });
});

describe('SecretStore with simulated OS encryption', () => {
  const plaintext = 'synthetic-test-only';
  function setup(platform = 'darwin') {
    const path = join(directory, 'key.enc');
    const encryption = {
      isAsyncEncryptionAvailable: vi.fn().mockResolvedValue(true),
      encryptStringAsync: vi
        .fn()
        .mockResolvedValue(Buffer.from('opaque-test-ciphertext')),
      decryptStringAsync: vi
        .fn()
        .mockResolvedValue({ result: plaintext, shouldReEncrypt: false }),
    };
    return {
      store: new SecretStore(path, encryption, platform),
      path,
      encryption,
    };
  }
  it('stores only encrypted bytes, retrieves only in main and removes idempotently', async () => {
    const { store, path, encryption } = setup();
    expect(await store.has()).toBe(false);
    expect(await store.get()).toBeNull();
    await store.set(plaintext);
    expect(await store.has()).toBe(true);
    expect(await readFile(path, 'utf8')).toBe('opaque-test-ciphertext');
    expect(await new SecretStore(path, encryption, 'darwin').get()).toBe(
      plaintext,
    );
    if (process.platform !== 'win32')
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    await store.remove();
    await store.remove();
    expect(await store.get()).toBeNull();
  });
  it('never initializes the keychain merely to report presence', async () => {
    const { store, encryption } = setup();
    await store.has();
    expect(encryption.isAsyncEncryptionAvailable).not.toHaveBeenCalled();
  });
  it.each(['linux', 'win32'])(
    'refuses unvalidated backends: %s',
    async (platform) => {
      const { store, encryption } = setup(platform);
      await expect(store.set(plaintext)).rejects.toThrow('SECRET_UNAVAILABLE');
      expect(encryption.encryptStringAsync).not.toHaveBeenCalled();
      expect(await store.has()).toBe(false);
    },
  );
  it('fails closed when the OS store is unavailable and preserves the previous secret', async () => {
    const { store, encryption, path } = setup();
    await store.set(plaintext);
    encryption.isAsyncEncryptionAvailable.mockResolvedValue(false);
    await expect(store.set('replacement')).rejects.toThrow(
      'SECRET_UNAVAILABLE',
    );
    await expect(store.get()).rejects.toThrow('SECRET_UNAVAILABLE');
    expect(await readFile(path, 'utf8')).toBe('opaque-test-ciphertext');
  });
  it('redacts encryption and decryption errors and handles rotation', async () => {
    const { store, encryption } = setup();
    encryption.encryptStringAsync.mockRejectedValueOnce(new Error(plaintext));
    await expect(store.set(plaintext)).rejects.toThrow(/^SECRET_UNAVAILABLE$/);
    expect(await store.has()).toBe(false);
    await store.set(plaintext);
    encryption.decryptStringAsync.mockRejectedValueOnce(new Error(plaintext));
    await expect(store.get()).rejects.toThrow(/^SECRET_UNAVAILABLE$/);
    encryption.decryptStringAsync.mockResolvedValue({
      result: plaintext,
      shouldReEncrypt: true,
    });
    expect(await store.get()).toBe(plaintext);
    expect(encryption.encryptStringAsync).toHaveBeenCalledTimes(3);
  });
  it.each(['', 'two words', 'x'.repeat(4097)])(
    'rejects malformed secrets before encryption',
    async (value) => {
      const { store, encryption } = setup();
      await expect(store.set(value)).rejects.toThrow('SECRET_UNAVAILABLE');
      expect(encryption.encryptStringAsync).not.toHaveBeenCalled();
    },
  );
});
