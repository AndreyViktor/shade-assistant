import { hasExactKeys } from '../validation';
import type { IpcErrorCode } from './appStatus';

export const READINESS_IPC_VERSION = 1;
export const READINESS_CHANNEL = 'meeting-copilot:readiness';

export const PREFLIGHT_STATES = [
  'not-requested',
  'allowed',
  'denied',
  'restricted',
  'unavailable',
] as const;
export type PreflightState = (typeof PREFLIGHT_STATES)[number];

export const PERMISSION_SETTINGS_TARGETS = [
  'microphone',
  'screen-recording',
  'speech-recognition',
] as const;
export type PermissionSettingsTarget =
  (typeof PERMISSION_SETTINGS_TARGETS)[number];

export type ReadinessItem = {
  state: PreflightState;
  detail:
    | 'exact'
    | 'screen-preflight-ambiguous'
    | 'helper-missing'
    | 'helper-invalid-response';
};

export type HelperIdentity = {
  process: 'MeetingCopilotTranscriber';
  bundleIdentifier: string;
  signingIdentifier: string;
  signature: 'no-team' | 'team-signed';
};

export type ReadinessSnapshot = {
  owner: {
    capture: 'MeetingCopilotTranscriber';
    host: 'Meeting Copilot';
  };
  microphone: ReadinessItem;
  systemAudio: ReadinessItem;
  speechRecognition: ReadinessItem;
  helper: ReadinessItem;
  helperIdentity: HelperIdentity | null;
};

export type ReadinessRequest =
  | { version: typeof READINESS_IPC_VERSION; action: 'check' }
  | {
      version: typeof READINESS_IPC_VERSION;
      action: 'open-settings';
      target: PermissionSettingsTarget;
    };

export type ReadinessResult =
  | {
      version: typeof READINESS_IPC_VERSION;
      ok: true;
      action: 'check';
      readiness: ReadinessSnapshot;
    }
  | {
      version: typeof READINESS_IPC_VERSION;
      ok: true;
      action: 'open-settings';
      target: PermissionSettingsTarget;
    }
  | {
      version: typeof READINESS_IPC_VERSION;
      ok: false;
      code: IpcErrorCode;
    };

const FAILURE_CODES: readonly IpcErrorCode[] = [
  'INVALID_REQUEST',
  'UNSUPPORTED_VERSION',
  'FORBIDDEN',
  'INVALID_RESPONSE',
  'UNAVAILABLE',
  'TIMEOUT',
];
const DETAILS: ReadinessItem['detail'][] = [
  'exact',
  'screen-preflight-ambiguous',
  'helper-missing',
  'helper-invalid-response',
];

export function readinessFailure(code: IpcErrorCode): ReadinessResult {
  return { version: READINESS_IPC_VERSION, ok: false, code };
}

export function parseReadinessRequest(value: unknown): ReadinessRequest | null {
  if (!hasExactKeys(value, ['version', 'action'])) return parseOpen(value);
  if (value.version !== READINESS_IPC_VERSION || value.action !== 'check')
    return null;
  return { version: READINESS_IPC_VERSION, action: 'check' };
}

function parseOpen(value: unknown): ReadinessRequest | null {
  if (!hasExactKeys(value, ['version', 'action', 'target'])) return null;
  if (
    value.version !== READINESS_IPC_VERSION ||
    value.action !== 'open-settings'
  )
    return null;
  const target = PERMISSION_SETTINGS_TARGETS.find(
    (candidate) => candidate === value.target,
  );
  return target
    ? { version: READINESS_IPC_VERSION, action: 'open-settings', target }
    : null;
}

export function parseReadinessResult(value: unknown): ReadinessResult {
  if (
    hasExactKeys(value, ['version', 'ok', 'action', 'readiness']) &&
    value.version === READINESS_IPC_VERSION &&
    value.ok === true &&
    value.action === 'check'
  ) {
    const readiness = parseSnapshot(value.readiness);
    if (readiness)
      return {
        version: READINESS_IPC_VERSION,
        ok: true,
        action: 'check',
        readiness,
      };
  }
  if (
    hasExactKeys(value, ['version', 'ok', 'action', 'target']) &&
    value.version === READINESS_IPC_VERSION &&
    value.ok === true &&
    value.action === 'open-settings'
  ) {
    const target = PERMISSION_SETTINGS_TARGETS.find(
      (candidate) => candidate === value.target,
    );
    if (target)
      return {
        version: READINESS_IPC_VERSION,
        ok: true,
        action: 'open-settings',
        target,
      };
  }
  if (
    hasExactKeys(value, ['version', 'ok', 'code']) &&
    value.version === READINESS_IPC_VERSION &&
    value.ok === false
  ) {
    const code = FAILURE_CODES.find((candidate) => candidate === value.code);
    if (code) return readinessFailure(code);
  }
  return readinessFailure('INVALID_RESPONSE');
}

export function unavailableReadiness(
  detail: 'helper-missing' | 'helper-invalid-response',
): ReadinessSnapshot {
  const item = { state: 'unavailable' as const, detail };
  return {
    owner: {
      capture: 'MeetingCopilotTranscriber',
      host: 'Meeting Copilot',
    },
    microphone: item,
    systemAudio: item,
    speechRecognition: item,
    helper: item,
    helperIdentity: null,
  };
}

function parseSnapshot(value: unknown): ReadinessSnapshot | null {
  if (
    !hasExactKeys(value, [
      'owner',
      'microphone',
      'systemAudio',
      'speechRecognition',
      'helper',
      'helperIdentity',
    ]) ||
    !hasExactKeys(value.owner, ['capture', 'host']) ||
    value.owner.capture !== 'MeetingCopilotTranscriber' ||
    value.owner.host !== 'Meeting Copilot'
  )
    return null;
  const microphone = parseItem(value.microphone);
  const systemAudio = parseItem(value.systemAudio);
  const speechRecognition = parseItem(value.speechRecognition);
  const helper = parseItem(value.helper);
  const helperIdentity = parseIdentity(value.helperIdentity);
  if (!microphone || !systemAudio || !speechRecognition || !helper) return null;
  if (value.helperIdentity !== null && !helperIdentity) return null;
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
  const detail = DETAILS.find((candidate) => candidate === value.detail);
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
