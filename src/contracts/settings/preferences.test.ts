import { describe, expect, it } from 'vitest';
import { defaultPreferences, parsePreferences } from './preferences';
import { parseSettingsRequest, parseSettingsResult } from '../ipc/settings';

const defaults = defaultPreferences('darwin');

describe('settings v1 contract', () => {
  it('defaults to demo, Apple Swift on Mac and pt-BR; never remote on other platforms', () => {
    expect(defaults).toEqual({
      version: 1,
      mode: 'demo',
      sttProvider: 'apple-local',
      language: 'pt-BR',
    });
    expect(defaultPreferences('linux').sttProvider).toBe('mock');
  });
  it.each(['pt-BR', 'en-US', 'pt-BR+en-US'])(
    'accepts a language preference without claiming support: %s',
    (language) => {
      expect(parsePreferences({ ...defaults, mode: 'real', language })).toEqual(
        { ...defaults, mode: 'real', language },
      );
    },
  );
  it.each([
    null,
    [],
    {},
    { ...defaults, version: 2 },
    { ...defaults, secret: 'synthetic-key' },
    { ...defaults, sttProvider: 'openai-stt' },
    { ...defaults, language: 'xx' },
    { ...defaults, mode: 'active' },
  ])('rejects invalid, extra or unauthorized fields: %j', (value) => {
    expect(parsePreferences(value)).toBeNull();
    expect(
      parseSettingsRequest({ version: 1, action: 'save', preferences: value }),
    ).toBeNull();
  });
  it('allows only named operations, never a secret or filesystem path', () => {
    for (const action of ['read', 'import-secret', 'remove-secret']) {
      expect(parseSettingsRequest({ version: 1, action })).toEqual({
        version: 1,
        action,
      });
      expect(
        parseSettingsRequest({ version: 1, action, path: '/private/key' }),
      ).toBeNull();
    }
    expect(parseSettingsRequest({ version: 2, action: 'read' })).toBeNull();
    expect(
      parseSettingsRequest({ version: 1, action: 'get-secret' }),
    ).toBeNull();
  });
  it('copies a public snapshot and rejects plaintext, encrypted bytes, and malformed replies', () => {
    const result = {
      version: 1,
      ok: true,
      settings: { preferences: defaults, credential: 'stored' },
    };
    expect(parseSettingsResult(result)).toEqual(result);
    for (const value of [
      { ...result, key: 'synthetic' },
      { ...result, settings: { ...result.settings, secret: 'synthetic' } },
      { ...result, settings: { ...result.settings, credential: 'synthetic' } },
      { version: 1, ok: true, status: {} },
    ]) {
      expect(parseSettingsResult(value)).toEqual({
        version: 1,
        ok: false,
        code: 'INVALID_RESPONSE',
      });
    }
    expect(
      parseSettingsResult({ version: 1, ok: false, code: 'TIMEOUT' }),
    ).toEqual({ version: 1, ok: false, code: 'TIMEOUT' });
  });
});
