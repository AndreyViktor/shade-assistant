import { describe, expect, it } from 'vitest';
import { defaultPreferences, parsePreferences } from './preferences';
import { parseSettingsRequest, parseSettingsResult } from '../ipc/settings';

const defaults = defaultPreferences('darwin');

describe('settings envelope v1 with preferences v4 contract', () => {
  it('defaults to demo, Apple Swift on Mac and pt-BR; never remote on other platforms', () => {
    expect(defaults).toEqual({
      version: 4,
      audioSource: 'both',
      suggestionProvider: 'openai',
      suggestionModel: 'gpt-5.4-mini',
      meetingProfile: 'none',
      mode: 'demo',
      sttProvider: 'apple-local',
      language: 'pt-BR',
    });
    expect(defaultPreferences('linux').sttProvider).toBe('mock');
  });
  it.each(['mic', 'system', 'both'])(
    'accepts saved source %s without consent',
    (audioSource) => {
      const preferences = { ...defaults, audioSource };
      expect(parsePreferences(preferences)).toEqual(preferences);
      expect(
        parseSettingsRequest({ version: 1, action: 'save', preferences }),
      ).toEqual({ version: 1, action: 'save', preferences });
    },
  );
  it.each(['pt-BR', 'en-US'])(
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
    { ...defaults, version: 5 },
    { ...defaults, version: 2 },
    { ...defaults, audioSource: undefined },
    { ...defaults, audioSource: 'unknown' },
    { ...defaults, audioSource: ['mic', 'system'] },
    { ...defaults, version: 1 },
    { ...defaults, suggestionProvider: 'future-provider' },
    { ...defaults, suggestionModel: 'unknown-model' },
    { ...defaults, meetingProfile: 'custom-sensitive-profile' },
    { ...defaults, meetingProfile: undefined },
    { ...defaults, maxRequests: 10 },
    { ...defaults, consent: true },
    { ...defaults, language: 'pt-BR+en-US' },
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
