import { hasExactKeys } from '../validation';
import { DEFAULT_SUGGESTION_MODEL, SUGGESTION_MODELS } from './providerOptions';
import type { SuggestionModel } from './providerOptions';
import {
  parseMeetingProfileId,
  type MeetingProfileId,
} from '../meeting/meetingProfile';

export type Preferences = {
  version: 4;
  audioSource: 'mic' | 'system' | 'both';
  mode: 'demo' | 'real';
  sttProvider: 'apple-local' | 'mock';
  language: 'pt-BR' | 'en-US';
  suggestionProvider: 'openai';
  suggestionModel: SuggestionModel;
  meetingProfile: MeetingProfileId;
};

export function defaultPreferences(platform: string): Preferences {
  return {
    version: 4,
    audioSource: 'both',
    mode: 'demo',
    sttProvider: platform === 'darwin' ? 'apple-local' : 'mock',
    language: 'pt-BR',
    suggestionProvider: 'openai',
    suggestionModel: DEFAULT_SUGGESTION_MODEL,
    meetingProfile: 'none',
  };
}

export function parsePreferences(value: unknown): Preferences | null {
  if (
    !hasExactKeys(value, [
      'version',
      'audioSource',
      'mode',
      'sttProvider',
      'language',
      'suggestionProvider',
      'suggestionModel',
      'meetingProfile',
    ]) ||
    value.version !== 4 ||
    (value.audioSource !== 'mic' &&
      value.audioSource !== 'system' &&
      value.audioSource !== 'both') ||
    (value.mode !== 'demo' && value.mode !== 'real') ||
    (value.sttProvider !== 'apple-local' && value.sttProvider !== 'mock') ||
    (value.language !== 'pt-BR' && value.language !== 'en-US') ||
    value.suggestionProvider !== 'openai' ||
    !SUGGESTION_MODELS.some((model) => model.id === value.suggestionModel) ||
    parseMeetingProfileId(value.meetingProfile) === null
  )
    return null;
  return {
    version: 4,
    audioSource: value.audioSource,
    mode: value.mode,
    sttProvider: value.sttProvider,
    language: value.language,
    suggestionProvider: value.suggestionProvider,
    suggestionModel: value.suggestionModel as SuggestionModel,
    meetingProfile: value.meetingProfile as MeetingProfileId,
  };
}

/** Disk-only migration. IPC accepts only the current preference schema. */
export function migratePreferences(value: unknown): Preferences | null {
  const current = parsePreferences(value);
  if (current) return current;
  if (
    hasExactKeys(value, [
      'version',
      'audioSource',
      'mode',
      'sttProvider',
      'language',
      'suggestionProvider',
      'suggestionModel',
    ]) &&
    value.version === 3
  ) {
    return parsePreferences({
      ...value,
      version: 4,
      meetingProfile: 'none',
    });
  }
  if (
    hasExactKeys(value, [
      'version',
      'mode',
      'sttProvider',
      'language',
      'suggestionProvider',
      'suggestionModel',
    ]) &&
    value.version === 2
  ) {
    return parsePreferences({
      ...value,
      version: 4,
      audioSource: 'both',
      meetingProfile: 'none',
    });
  }
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
