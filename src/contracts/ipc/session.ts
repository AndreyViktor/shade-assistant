import { parseLocalTranscript } from '../meeting/localTranscript';
import type { LocalTranscriptSnapshot } from '../meeting/localTranscript';
import { isSuggestionId } from '../meeting/suggestion';
import { parseDemoSnapshot } from '../meeting/demo';
import type { DemoSnapshot } from '../meeting/demo';
import { hasExactKeys } from '../validation';
import { parseSessionSnapshot, parseSessionStart } from '../meeting/session';
import type { SessionSnapshot, SessionStart } from '../meeting/session';
import { parseStatusResult } from './appStatus';
import type { IpcErrorCode } from './appStatus';

export const SESSION_CHANNEL = 'meeting-copilot:session';
export type SessionRequest =
  | { version: 3; action: 'read' | 'pause' | 'resume' | 'stop' }
  | { version: 3; action: 'start'; options: SessionStart }
  | { version: 3; action: 'dismiss-suggestion'; id: string };
export type SessionResult =
  | {
      version: 3;
      ok: true;
      session: SessionSnapshot;
      demo: DemoSnapshot;
      local: LocalTranscriptSnapshot | null;
    }
  | { version: 3; ok: false; code: IpcErrorCode };

export function parseSessionRequest(value: unknown): SessionRequest | null {
  if (
    hasExactKeys(value, ['version', 'action']) &&
    value.version === 3 &&
    (value.action === 'read' ||
      value.action === 'pause' ||
      value.action === 'resume' ||
      value.action === 'stop')
  ) {
    return { version: 3, action: value.action };
  }
  if (
    hasExactKeys(value, ['version', 'action', 'options']) &&
    value.version === 3 &&
    value.action === 'start'
  ) {
    const options = parseSessionStart(value.options);
    if (options) return { version: 3, action: 'start', options };
  }
  if (
    hasExactKeys(value, ['version', 'action', 'id']) &&
    value.version === 3 &&
    value.action === 'dismiss-suggestion' &&
    isSuggestionId(value.id)
  ) {
    return { version: 3, action: 'dismiss-suggestion', id: value.id };
  }
  return null;
}

export function parseSessionResult(value: unknown): SessionResult {
  if (
    hasExactKeys(value, ['version', 'ok', 'session', 'demo', 'local']) &&
    value.version === 3 &&
    value.ok === true
  ) {
    const session = parseSessionSnapshot(value.session);
    const demo = parseDemoSnapshot(value.demo);
    try {
      const local = parseLocalTranscript(value.local);
      if (session && demo && (session.mode === 'apple-local' || local === null))
        return { version: 3, ok: true, session, demo, local };
    } catch {
      return { version: 3, ok: false, code: 'INVALID_RESPONSE' };
    }
  }
  const failure = parseStatusResult(
    hasExactKeys(value, ['version', 'ok', 'code']) && value.version === 3
      ? { ...value, version: 1 }
      : null,
  );
  return failure.ok
    ? { version: 3, ok: false, code: 'INVALID_RESPONSE' }
    : { ...failure, version: 3 };
}
