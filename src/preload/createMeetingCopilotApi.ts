import {
  SESSION_CHANNEL,
  parseSessionRequest,
  parseSessionResult,
} from '../contracts/ipc/session';
import type { SessionRequest } from '../contracts/ipc/session';
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

type Invoke = (
  channel:
    | typeof APP_STATUS_CHANNEL
    | typeof SETTINGS_CHANNEL
    | typeof SESSION_CHANNEL,
  request: { version: 1 } | SettingsRequest | SessionRequest,
) => Promise<unknown>;

export function createMeetingCopilotApi(invoke: Invoke): MeetingCopilotApi {
  async function call(
    channel:
      | typeof APP_STATUS_CHANNEL
      | typeof SETTINGS_CHANNEL
      | typeof SESSION_CHANNEL,
    request: { version: 1 } | SettingsRequest | SessionRequest,
    timeout: number,
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        invoke(channel, request),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(ipcFailure('TIMEOUT')), timeout);
        }),
      ]);
    } catch {
      return ipcFailure('UNAVAILABLE');
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

  return Object.freeze({
    async session(...args: unknown[]) {
      const request = args.length === 1 ? parseSessionRequest(args[0]) : null;
      if (!request)
        return {
          version: 1 as const,
          ok: false as const,
          code: 'INVALID_REQUEST' as const,
        };
      return parseSessionResult(await call(SESSION_CHANNEL, request, 5000));
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
  });
}
