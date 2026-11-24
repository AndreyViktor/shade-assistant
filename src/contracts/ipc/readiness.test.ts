import { describe, expect, it } from 'vitest';
import {
  PREFLIGHT_STATES,
  parseReadinessRequest,
  parseReadinessResult,
  unavailableReadiness,
} from './readiness';

const identity = {
  process: 'MeetingCopilotTranscriber' as const,
  bundleIdentifier: 'local.meetingcopilot.transcriber',
  signingIdentifier: 'local.meetingcopilot.transcriber',
  signature: 'no-team' as const,
};

describe('readiness IPC contract', () => {
  it('accepts only closed check and settings actions', () => {
    expect(parseReadinessRequest({ version: 1, action: 'check' })).toEqual({
      version: 1,
      action: 'check',
    });
    expect(
      parseReadinessRequest({
        version: 1,
        action: 'open-settings',
        target: 'microphone',
      }),
    ).toEqual({ version: 1, action: 'open-settings', target: 'microphone' });
    for (const invalid of [
      { version: 2, action: 'check' },
      { version: 1, action: 'open-settings', target: 'privacy' },
      { version: 1, action: 'check', secret: 'synthetic' },
      { version: 1, action: 'capture' },
    ])
      expect(parseReadinessRequest(invalid)).toBeNull();
  });

  it.each(PREFLIGHT_STATES)('preserves the closed %s state', (state) => {
    const item = { state, detail: 'exact' as const };
    const result = parseReadinessResult({
      version: 1,
      ok: true,
      action: 'check',
      readiness: {
        owner: {
          capture: 'MeetingCopilotTranscriber',
          host: 'Meeting Copilot',
        },
        microphone: item,
        systemAudio: item,
        speechRecognition: item,
        helper: item,
        helperIdentity: identity,
      },
    });
    expect(result).toMatchObject({
      ok: true,
      action: 'check',
      readiness: { microphone: { state } },
    });
  });

  it('rejects extra/private fields and inconsistent helper identity', () => {
    const readiness = unavailableReadiness('helper-missing');
    expect(
      parseReadinessResult({
        version: 1,
        ok: true,
        action: 'check',
        readiness: { ...readiness, privatePath: '/private/helper' },
      }),
    ).toEqual({ version: 1, ok: false, code: 'INVALID_RESPONSE' });
    expect(
      parseReadinessResult({
        version: 1,
        ok: true,
        action: 'check',
        readiness: { ...readiness, helperIdentity: { ...identity, team: 'x' } },
      }),
    ).toEqual({ version: 1, ok: false, code: 'INVALID_RESPONSE' });
  });
});
