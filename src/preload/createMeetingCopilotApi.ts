import {
  APP_STATUS_CHANNEL,
  IPC_VERSION,
  ipcFailure,
  parseStatusResult,
} from '../contracts/ipc/appStatus';
import type {
  AppStatusRequest,
  AppStatusResult,
  MeetingCopilotApi,
} from '../contracts/ipc/appStatus';

type InvokeStatus = (
  channel: typeof APP_STATUS_CHANNEL,
  request: AppStatusRequest,
) => Promise<unknown>;

export function createMeetingCopilotApi(
  invoke: InvokeStatus,
): MeetingCopilotApi {
  return Object.freeze({
    async getStatus(...args: unknown[]): Promise<AppStatusResult> {
      if (args.length !== 0) return ipcFailure('INVALID_REQUEST');
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const response = await Promise.race([
          invoke(APP_STATUS_CHANNEL, { version: IPC_VERSION }),
          new Promise<AppStatusResult>((resolve) => {
            timer = setTimeout(() => resolve(ipcFailure('TIMEOUT')), 5000);
          }),
        ]);
        return parseStatusResult(response);
      } catch {
        // Electron errors can contain privileged paths/payloads. Never forward them.
        return ipcFailure('UNAVAILABLE');
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
