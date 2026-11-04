import { hasExactKeys } from '../validation';
import { parseSessionSnapshot, parseSessionStart } from '../meeting/session';
import type { SessionSnapshot, SessionStart } from '../meeting/session';
import { parseStatusResult } from './appStatus';
import type { IpcErrorCode } from './appStatus';

export const SESSION_CHANNEL = 'meeting-copilot:session';
export type SessionRequest =
  | { version: 1; action: 'read' | 'pause' | 'resume' | 'stop' }
  | { version: 1; action: 'start'; options: SessionStart };
export type SessionResult =
  | { version: 1; ok: true; session: SessionSnapshot }
  | { version: 1; ok: false; code: IpcErrorCode };

export function parseSessionRequest(value: unknown): SessionRequest | null {
  if (
    hasExactKeys(value, ['version', 'action']) &&
    value.version === 1 &&
    (value.action === 'read' ||
      value.action === 'pause' ||
      value.action === 'resume' ||
      value.action === 'stop')
  ) {
    return { version: 1, action: value.action };
  }
  if (
    hasExactKeys(value, ['version', 'action', 'options']) &&
    value.version === 1 &&
    value.action === 'start'
  ) {
    const options = parseSessionStart(value.options);
    if (options) return { version: 1, action: 'start', options };
  }
  return null;
}

export function parseSessionResult(value: unknown): SessionResult {
  if (
    hasExactKeys(value, ['version', 'ok', 'session']) &&
    value.version === 1 &&
    value.ok === true
  ) {
    const session = parseSessionSnapshot(value.session);
    if (session) return { version: 1, ok: true, session };
  }
  const failure = parseStatusResult(value);
  return failure.ok
    ? { version: 1, ok: false, code: 'INVALID_RESPONSE' }
    : failure;
}
