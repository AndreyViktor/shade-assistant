// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseNativeReadiness } from './probeNativeReadiness';

function report() {
  return {
    reportVersion: 1,
    scope: 'session-preflight-no-capture',
    owner: {
      capture: 'MeetingCopilotTranscriber',
      host: 'Meeting Copilot',
    },
    microphone: { state: 'not-requested', detail: 'exact' },
    systemAudio: { state: 'denied', detail: 'screen-preflight-ambiguous' },
    speechRecognition: { state: 'restricted', detail: 'exact' },
    helper: { state: 'allowed', detail: 'exact' },
    helperIdentity: {
      process: 'MeetingCopilotTranscriber',
      bundleIdentifier: 'local.meetingcopilot.transcriber',
      signingIdentifier: 'local.meetingcopilot.transcriber',
      signature: 'no-team',
    },
  };
}

describe('native readiness parser', () => {
  it('accepts the no-capture report and preserves screen ambiguity', () => {
    expect(parseNativeReadiness(report())).toMatchObject({
      microphone: { state: 'not-requested' },
      systemAudio: { state: 'denied', detail: 'screen-preflight-ambiguous' },
      speechRecognition: { state: 'restricted' },
      helper: { state: 'allowed' },
      helperIdentity: { signature: 'no-team' },
    });
  });

  it.each([
    { ...report(), scope: 'capture' },
    { ...report(), secret: 'synthetic' },
    { ...report(), microphone: { state: 'yes', detail: 'exact' } },
    {
      ...report(),
      helperIdentity: { ...report().helperIdentity, privatePath: '/private/x' },
    },
  ])('fails closed on malformed report %#', (value) => {
    expect(parseNativeReadiness(value)).toMatchObject({
      microphone: { state: 'unavailable', detail: 'helper-invalid-response' },
      helperIdentity: null,
    });
  });
});
