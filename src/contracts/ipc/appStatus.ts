export const IPC_VERSION = 1;
export const APP_STATUS_CHANNEL = 'meeting-copilot:app-status';

// Only capabilities implemented by the scaffold are public. Extend with their tasks.
export const APP_STATUS = {
  mode: 'demo',
  capture: 'inactive',
  ai: 'disabled',
  dataSent: 'none',
} as const;

const ERROR_CODES = [
  'INVALID_REQUEST',
  'UNSUPPORTED_VERSION',
  'FORBIDDEN',
  'INVALID_RESPONSE',
  'UNAVAILABLE',
  'TIMEOUT',
] as const;
export type IpcErrorCode = (typeof ERROR_CODES)[number];
export type AppStatusRequest = { version: typeof IPC_VERSION };
export type AppStatusResult =
  | { version: typeof IPC_VERSION; ok: true; status: typeof APP_STATUS }
  | { version: typeof IPC_VERSION; ok: false; code: IpcErrorCode };

export interface MeetingCopilotApi {
  readonly getStatus: () => Promise<AppStatusResult>;
}

export function ipcFailure(code: IpcErrorCode): AppStatusResult {
  return { version: IPC_VERSION, ok: false, code };
}

function hasExactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.ownKeys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

export function validateStatusRequest(value: unknown): IpcErrorCode | null {
  if (!hasExactKeys(value, ['version'])) return 'INVALID_REQUEST';
  if (typeof value.version !== 'number') return 'INVALID_REQUEST';
  return value.version === IPC_VERSION ? null : 'UNSUPPORTED_VERSION';
}

export function parseStatusResult(value: unknown): AppStatusResult {
  if (
    hasExactKeys(value, ['version', 'ok', 'status']) &&
    value.version === IPC_VERSION &&
    value.ok === true &&
    isAppStatus(value.status)
  ) {
    return { version: IPC_VERSION, ok: true, status: { ...APP_STATUS } };
  }
  if (
    hasExactKeys(value, ['version', 'ok', 'code']) &&
    value.version === IPC_VERSION &&
    value.ok === false
  ) {
    const code = ERROR_CODES.find((candidate) => candidate === value.code);
    if (code) return ipcFailure(code);
  }
  return ipcFailure('INVALID_RESPONSE');
}

function isAppStatus(value: unknown): boolean {
  return (
    hasExactKeys(value, Object.keys(APP_STATUS)) &&
    Object.entries(APP_STATUS).every(
      ([key, expected]) => value[key] === expected,
    )
  );
}
