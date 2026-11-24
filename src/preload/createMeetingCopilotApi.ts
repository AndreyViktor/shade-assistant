import {
  SHORTCUTS_CHANNEL,
  parseShortcutRequest,
  parseShortcutResult,
} from '../contracts/ipc/shortcuts';
import type { ShortcutRequest } from '../contracts/ipc/shortcuts';
import {
  SESSION_CHANNEL,
  SESSION_IPC_VERSION,
  parseSessionRequest,
  parseSessionResult,
} from '../contracts/ipc/session';
import type { SessionRequest, SessionResult } from '../contracts/ipc/session';
import {
  APP_STATUS_CHANNEL,
  IPC_VERSION,
  ipcFailure,
  parseStatusResult,
} from '../contracts/ipc/appStatus';
import type { MeetingCopilotApi } from '../contracts/ipc/appStatus';
import {
  SETTINGS_CHANNEL,
  parseSettingsRequest,
  parseSettingsResult,
  settingsFailure,
} from '../contracts/ipc/settings';
import type {
  SettingsRequest,
  SettingsResult,
} from '../contracts/ipc/settings';
import {
  READINESS_CHANNEL,
  READINESS_IPC_VERSION,
  parseReadinessRequest,
  parseReadinessResult,
  readinessFailure,
} from '../contracts/ipc/readiness';
import type {
  ReadinessRequest,
  ReadinessResult,
} from '../contracts/ipc/readiness';

type Invoke = (
  channel:
    | typeof SHORTCUTS_CHANNEL
    | typeof APP_STATUS_CHANNEL
    | typeof READINESS_CHANNEL
    | typeof SETTINGS_CHANNEL
    | typeof SESSION_CHANNEL,
  request:
    | { version: 1 }
    | ReadinessRequest
    | SettingsRequest
    | SessionRequest
    | ShortcutRequest,
) => Promise<unknown>;

export function createMeetingCopilotApi(invoke: Invoke): MeetingCopilotApi {
  async function call(
    channel:
      | typeof SHORTCUTS_CHANNEL
      | typeof APP_STATUS_CHANNEL
      | typeof READINESS_CHANNEL
      | typeof SETTINGS_CHANNEL
      | typeof SESSION_CHANNEL,
    request:
      | { version: 1 }
      | ReadinessRequest
      | SettingsRequest
      | SessionRequest
      | ShortcutRequest,
    timeout: number,
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        invoke(channel, request),
        new Promise((resolve) => {
          timer = setTimeout(
            () =>
              resolve({ ...ipcFailure('TIMEOUT'), version: request.version }),
            timeout,
          );
        }),
      ]);
    } catch {
      return { ...ipcFailure('UNAVAILABLE'), version: request.version };
    } finally {
      clearTimeout(timer);
    }
  }

  async function settings(request: unknown): Promise<SettingsResult> {
    const parsed = parseSettingsRequest(request);
    if (!parsed) return settingsFailure('INVALID_REQUEST');
    // A native picker may remain open while the user locates their file.
    return parseSettingsResult(
      await call(
        SETTINGS_CHANNEL,
        parsed,
        parsed.action === 'import-secret' ? 300000 : 5000,
      ),
    );
  }

  async function readiness(request: unknown): Promise<ReadinessResult> {
    const parsed = parseReadinessRequest(request);
    if (!parsed) return readinessFailure('INVALID_REQUEST');
    return parseReadinessResult(await call(READINESS_CHANNEL, parsed, 10000));
  }

  return Object.freeze({
    async setShortcutEditing(...args: unknown[]) {
      const request =
        args.length === 1
          ? parseShortcutRequest({
              version: 1,
              action: 'editing',
              editing: args[0],
            })
          : null;
      if (!request)
        return {
          version: 1 as const,
          ok: false as const,
          code: 'INVALID_REQUEST' as const,
        };
      return parseShortcutResult(await call(SHORTCUTS_CHANNEL, request, 5000));
    },
    async shortcuts(...args: unknown[]) {
      const action = args[0];
      const request =
        args.length === 1
          ? parseShortcutRequest(
              action === 'read' || action === 'restore'
                ? { version: 1, action }
                : { version: 1, action: 'save', shortcuts: action },
            )
          : null;
      if (!request)
        return {
          version: 1 as const,
          ok: false as const,
          code: 'INVALID_REQUEST' as const,
        };
      return parseShortcutResult(await call(SHORTCUTS_CHANNEL, request, 5000));
    },
    async session(...args: unknown[]): Promise<SessionResult> {
      const request = args.length === 1 ? parseSessionRequest(args[0]) : null;
      if (!request)
        return {
          version: SESSION_IPC_VERSION,
          ok: false as const,
          code: 'INVALID_REQUEST' as const,
        };
      // Starting may wait for a human TCC decision. Other commands include helper cleanup.
      const timeout =
        request.action === 'start'
          ? 300000
          : request.action === 'export-suggestion-feedback'
            ? 300000
            : request.action === 'read' ||
                request.action === 'dismiss-suggestion' ||
                request.action === 'rate-suggestion' ||
                request.action === 'clear-suggestion-feedback'
              ? 5000
              : 15000;
      return parseSessionResult(await call(SESSION_CHANNEL, request, timeout));
    },
    async getStatus(...args: unknown[]) {
      if (args.length !== 0) return ipcFailure('INVALID_REQUEST');
      return parseStatusResult(
        await call(APP_STATUS_CHANNEL, { version: IPC_VERSION }, 5000),
      );
    },
    async getSettings(...args: unknown[]) {
      if (args.length !== 0) return settingsFailure('INVALID_REQUEST');
      return settings({ version: 1, action: 'read' });
    },
    async savePreferences(...args: unknown[]) {
      if (args.length !== 1) return settingsFailure('INVALID_REQUEST');
      return settings({ version: 1, action: 'save', preferences: args[0] });
    },
    async importSecret(...args: unknown[]) {
      if (args.length !== 0) return settingsFailure('INVALID_REQUEST');
      return settings({ version: 1, action: 'import-secret' });
    },
    async removeSecret(...args: unknown[]) {
      if (args.length !== 0) return settingsFailure('INVALID_REQUEST');
      return settings({ version: 1, action: 'remove-secret' });
    },
    async getReadiness(...args: unknown[]) {
      if (args.length !== 0) return readinessFailure('INVALID_REQUEST');
      return readiness({ version: READINESS_IPC_VERSION, action: 'check' });
    },
    async openPermissionSettings(...args: unknown[]) {
      if (args.length !== 1) return readinessFailure('INVALID_REQUEST');
      return readiness({
        version: READINESS_IPC_VERSION,
        action: 'open-settings',
        target: args[0],
      });
    },
  });
}
