import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { hasExactKeys } from '../../contracts/validation';
import {
  PREFLIGHT_STATES,
  unavailableReadiness,
} from '../../contracts/ipc/readiness';
import type {
  HelperIdentity,
  ReadinessItem,
  ReadinessSnapshot,
} from '../../contracts/ipc/readiness';

const execute = promisify(execFile);

export async function probeNativeReadiness(
  resolveExecutable: () => Promise<string>,
): Promise<ReadinessSnapshot> {
  let executable: string;
  try {
    executable = await resolveExecutable();
  } catch {
    return unavailableReadiness('helper-missing');
  }
  try {
    const { stdout } = await execute(executable, ['--readiness'], {
      cwd: dirname(executable),
      env: {
        HOME: homedir(),
        LANG: process.env['LANG'] ?? 'en_US.UTF-8',
        PATH: '/usr/bin:/bin',
        TMPDIR: process.env['TMPDIR'] ?? '/tmp',
      },
      encoding: 'utf8',
      timeout: 8000,
      maxBuffer: 16_384,
      windowsHide: true,
    });
    return parseNativeReadiness(JSON.parse(stdout));
  } catch {
    return unavailableReadiness('helper-invalid-response');
  }
}

export function parseNativeReadiness(value: unknown): ReadinessSnapshot {
  if (
    !hasExactKeys(value, [
      'reportVersion',
      'scope',
      'owner',
      'microphone',
      'systemAudio',
      'speechRecognition',
      'helper',
      'helperIdentity',
    ]) ||
    value.reportVersion !== 1 ||
    value.scope !== 'session-preflight-no-capture' ||
    !hasExactKeys(value.owner, ['capture', 'host']) ||
    value.owner.capture !== 'MeetingCopilotTranscriber' ||
    value.owner.host !== 'Meeting Copilot'
  )
    return unavailableReadiness('helper-invalid-response');
  const microphone = parseItem(value.microphone);
  const systemAudio = parseItem(value.systemAudio);
  const speechRecognition = parseItem(value.speechRecognition);
  const helper = parseItem(value.helper);
  const helperIdentity = parseIdentity(value.helperIdentity);
  if (!microphone || !systemAudio || !speechRecognition || !helper)
    return unavailableReadiness('helper-invalid-response');
  if (value.helperIdentity !== null && !helperIdentity)
    return unavailableReadiness('helper-invalid-response');
  return {
    owner: { capture: 'MeetingCopilotTranscriber', host: 'Meeting Copilot' },
    microphone,
    systemAudio,
    speechRecognition,
    helper,
    helperIdentity,
  };
}

function parseItem(value: unknown): ReadinessItem | null {
  if (!hasExactKeys(value, ['state', 'detail'])) return null;
  const state = PREFLIGHT_STATES.find((candidate) => candidate === value.state);
  const detail = ['exact', 'screen-preflight-ambiguous'].find(
    (candidate) => candidate === value.detail,
  ) as ReadinessItem['detail'] | undefined;
  return state && detail ? { state, detail } : null;
}

function parseIdentity(value: unknown): HelperIdentity | null {
  if (value === null) return null;
  if (
    !hasExactKeys(value, [
      'process',
      'bundleIdentifier',
      'signingIdentifier',
      'signature',
    ]) ||
    value.process !== 'MeetingCopilotTranscriber' ||
    typeof value.bundleIdentifier !== 'string' ||
    typeof value.signingIdentifier !== 'string' ||
    !['no-team', 'team-signed'].includes(String(value.signature))
  )
    return null;
  return {
    process: 'MeetingCopilotTranscriber',
    bundleIdentifier: value.bundleIdentifier,
    signingIdentifier: value.signingIdentifier,
    signature: value.signature as HelperIdentity['signature'],
  };
}
