import { hasExactKeys } from '../validation';

export type SessionMode = 'demo' | 'apple-local' | 'openai-stt';
export type SessionPhase = 'idle' | 'running' | 'paused' | 'stopped';
export type SessionConsent = {
  capture: boolean;
  context: boolean;
  remoteAudio: boolean;
};
export type SessionStart = { mode: SessionMode; consent: SessionConsent };
export type SessionSnapshot = {
  phase: SessionPhase;
  mode: SessionMode;
  consent: SessionConsent;
};

export function parseSessionStart(value: unknown): SessionStart | null {
  if (
    !hasExactKeys(value, ['mode', 'consent']) ||
    (value.mode !== 'demo' &&
      value.mode !== 'apple-local' &&
      value.mode !== 'openai-stt') ||
    !hasExactKeys(value.consent, ['capture', 'context', 'remoteAudio']) ||
    typeof value.consent.capture !== 'boolean' ||
    typeof value.consent.context !== 'boolean' ||
    typeof value.consent.remoteAudio !== 'boolean'
  )
    return null;
  return {
    mode: value.mode,
    consent: {
      capture: value.consent.capture,
      context: value.consent.context,
      remoteAudio: value.consent.remoteAudio,
    },
  };
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
  const start = parseSessionStart({ mode: value.mode, consent: value.consent });
  return start ? { phase: value.phase, ...start } : null;
}
