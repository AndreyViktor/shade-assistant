import { hasExactKeys } from '../validation';

export type Preferences = {
  version: 1;
  mode: 'demo' | 'real';
  sttProvider: 'apple-local' | 'mock';
  language: 'pt-BR' | 'en-US' | 'pt-BR+en-US';
};

export function defaultPreferences(platform: string): Preferences {
  return {
    version: 1,
    mode: 'demo',
    sttProvider: platform === 'darwin' ? 'apple-local' : 'mock',
    language: 'pt-BR',
  };
}

export function parsePreferences(value: unknown): Preferences | null {
  if (
    !hasExactKeys(value, ['version', 'mode', 'sttProvider', 'language']) ||
    value.version !== 1 ||
    (value.mode !== 'demo' && value.mode !== 'real') ||
    (value.sttProvider !== 'apple-local' && value.sttProvider !== 'mock') ||
    (value.language !== 'pt-BR' &&
      value.language !== 'en-US' &&
      value.language !== 'pt-BR+en-US')
  )
    return null;
  return {
    version: 1,
    mode: value.mode,
    sttProvider: value.sttProvider,
    language: value.language,
  };
}
