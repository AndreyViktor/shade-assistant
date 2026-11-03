import { describe, expect, it } from 'vitest';
import {
  APP_STATUS,
  IPC_VERSION,
  ipcFailure,
  parseStatusResult,
  validateStatusRequest,
} from './appStatus';

describe('versioned app status contract', () => {
  it('accepts the exact v1 request and distinguishes version mismatch', () => {
    expect(validateStatusRequest({ version: IPC_VERSION })).toBeNull();
    expect(validateStatusRequest({ version: 2 })).toBe('UNSUPPORTED_VERSION');
  });

  it.each([
    undefined,
    null,
    false,
    [],
    'status',
    {},
    { version: '1' },
    { version: 1, secret: 'not-allowed' },
    { version: 1, text: 'x'.repeat(100_000) },
  ])('rejects malformed/extra request data (%#)', (input) => {
    expect(validateStatusRequest(input)).toBe('INVALID_REQUEST');
  });

  it('round trips success and safe errors without sharing mutable state', () => {
    const response = {
      version: IPC_VERSION,
      ok: true,
      status: { ...APP_STATUS },
    };
    const parsed = parseStatusResult(JSON.parse(JSON.stringify(response)));
    expect(parsed).toEqual(response);
    expect(parsed).not.toBe(response);
    expect(parseStatusResult(ipcFailure('FORBIDDEN'))).toEqual(
      ipcFailure('FORBIDDEN'),
    );
  });

  it.each([
    undefined,
    null,
    [],
    { version: 2, ok: true, status: APP_STATUS },
    { version: 1, ok: true, status: { ...APP_STATUS, apiKey: 'fake-secret' } },
    { version: 1, ok: true, status: { ...APP_STATUS, capture: 'active' } },
    { version: 1, ok: true, status: { mode: 'demo' } },
    { version: 1, ok: true, status: APP_STATUS, extra: 'x' },
    { version: 1, ok: false, code: 'UNKNOWN' },
    { version: 1, ok: false, code: 'FORBIDDEN', stack: 'private' },
  ])('rejects incompatible or non-public responses (%#)', (input) => {
    expect(parseStatusResult(input)).toEqual(ipcFailure('INVALID_RESPONSE'));
  });
});
