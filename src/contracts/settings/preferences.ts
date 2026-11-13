import { hasExactKeys } from '../validation';
import { DEFAULT_SUGGESTION_MODEL, SUGGESTION_MODELS } from './providerOptions';
import type { SuggestionModel } from './providerOptions';

export type Preferences = {
  version: 2;
  mode: 'demo' | 'real';
  sttProvider: 'apple-local' | 'mock';
  language: 'pt-BR' | 'en-US';
  suggestionProvider: 'openai';
  suggestionModel: SuggestionModel;
};

export function defaultPreferences(platform: string): Preferences {
  return {
    version: 2,
    mode: 'demo',
    sttProvider: platform === 'darwin' ? 'apple-local' : 'mock',
    language: 'pt-BR',
    suggestionProvider: 'openai',
    suggestionModel: DEFAULT_SUGGESTION_MODEL,
  };
}

export function parsePreferences(value: unknown): Preferences | null {
  if (
    !hasExactKeys(value, [
      'version',
      'mode',
      'sttProvider',
      'language',
      'suggestionProvider',
      'suggestionModel',
    ]) ||
    value.version !== 2 ||
    (value.mode !== 'demo' && value.mode !== 'real') ||
    (value.sttProvider !== 'apple-local' && value.sttProvider !== 'mock') ||
    (value.language !== 'pt-BR' && value.language !== 'en-US') ||
    value.suggestionProvider !== 'openai' ||
    !SUGGESTION_MODELS.some((model) => model.id === value.suggestionModel)
  )
    return null;
  return {
    version: 2,
    mode: value.mode,
    sttProvider: value.sttProvider,
    language: value.language,
    suggestionProvider: value.suggestionProvider,
    suggestionModel: value.suggestionModel as SuggestionModel,
  };
}

/** Disk-only migration. IPC accepts only the current preference schema. */
export function migratePreferences(value: unknown): Preferences | null {
  const current = parsePreferences(value);
  if (current) return current;
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
    ...defaultPreferences('darwin'),
    mode: value.mode,
    sttProvider: value.sttProvider,
    // The previous runtime already used pt-BR for the unimplemented bilingual choice.
    language: value.language === 'en-US' ? 'en-US' : 'pt-BR',
  };
}
