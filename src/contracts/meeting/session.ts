import { hasExactKeys } from '../validation';
import type { AudioSource, TranscriptionLocale } from '../native/protocol';

export type SessionMode = 'demo' | 'apple-local' | 'openai-stt';
export type SessionPhase = 'idle' | 'running' | 'paused' | 'stopped';
export type SessionConsent = {
  capture: boolean;
  context: boolean;
  remoteAudio: boolean;
};
export type SessionStart =
  | { mode: 'demo'; consent: SessionConsent }
  | {
      mode: 'apple-local';
      consent: SessionConsent;
      locale: TranscriptionLocale;
      sources: AudioSource[];
    }
  | { mode: 'openai-stt'; consent: SessionConsent };
export type SessionSnapshot = {
  phase: SessionPhase;
  mode: SessionMode;
  consent: SessionConsent;
};

export function parseSessionStart(value: unknown): SessionStart | null {
  const consent = parseSessionConsent(value);
  if (!consent) return null;
  if (
    hasExactKeys(value, ['mode', 'consent']) &&
    (value.mode === 'demo' || value.mode === 'openai-stt')
  )
    return { mode: value.mode, consent };
  if (
    hasExactKeys(value, ['mode', 'consent', 'locale', 'sources']) &&
    value.mode === 'apple-local' &&
    !consent.remoteAudio &&
    (value.locale === 'pt-BR' || value.locale === 'en-US') &&
    Array.isArray(value.sources) &&
    value.sources.length >= 1 &&
    value.sources.length <= 2 &&
    value.sources.every(isAudioSource) &&
    new Set(value.sources).size === value.sources.length
  )
    return {
      mode: 'apple-local',
      consent,
      locale: value.locale,
      sources: [...value.sources],
    };
  return null;
}

export function parseSessionSnapshot(value: unknown): SessionSnapshot | null {
  if (
    !hasExactKeys(value, ['phase', 'mode', 'consent']) ||
    (value.phase !== 'idle' &&
      value.phase !== 'running' &&
      value.phase !== 'paused' &&
      value.phase !== 'stopped')
  )
    return null;
  const consent = parseSessionConsent(value);
  if (
    !consent ||
    (value.mode !== 'demo' &&
      value.mode !== 'apple-local' &&
      value.mode !== 'openai-stt') ||
    (value.mode === 'demo' &&
      (consent.capture || consent.context || consent.remoteAudio)) ||
    (value.mode === 'apple-local' && consent.remoteAudio)
  )
    return null;
  return { phase: value.phase, mode: value.mode, consent };
}

function parseSessionConsent(value: unknown): SessionConsent | null {
  if (
    !hasExactKeys(value, ['mode', 'consent']) &&
    !hasExactKeys(value, ['phase', 'mode', 'consent']) &&
    !hasExactKeys(value, ['mode', 'consent', 'locale', 'sources'])
  )
    return null;
  if (
    typeof value !== 'object' ||
    value === null ||
    !('consent' in value) ||
    !hasExactKeys(value.consent, ['capture', 'context', 'remoteAudio']) ||
    typeof value.consent.capture !== 'boolean' ||
    typeof value.consent.context !== 'boolean' ||
    typeof value.consent.remoteAudio !== 'boolean'
  )
    return null;
  return {
    capture: value.consent.capture,
    context: value.consent.context,
    remoteAudio: value.consent.remoteAudio,
  };
}

function isAudioSource(value: unknown): value is AudioSource {
  return value === 'mic' || value === 'system';
}
