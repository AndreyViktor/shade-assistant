import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_STATUS,
  APP_STATUS_CHANNEL,
  ipcFailure,
} from '../contracts/ipc/appStatus';
import { createMeetingCopilotApi } from './createMeetingCopilotApi';

afterEach(() => vi.useRealTimers());

describe('limited preload API', () => {
  const success = { version: 1, ok: true, status: APP_STATUS };

  it('exposes only a frozen method and invokes only the fixed channel', async () => {
    const invoke = vi.fn().mockResolvedValue(success);
    const api = createMeetingCopilotApi(invoke);
    expect(Object.keys(api)).toEqual(['getStatus']);
    expect(Object.isFrozen(api)).toBe(true);
    expect(await api.getStatus()).toEqual(success);
    expect(invoke).toHaveBeenCalledExactlyOnceWith(APP_STATUS_CHANNEL, {
      version: 1,
    });
  });

  it('rejects runtime arguments without sending them to main', async () => {
    const invoke = vi.fn();
    const api = createMeetingCopilotApi(invoke);
    expect(
      await Reflect.apply(api.getStatus, api, ['arbitrary:channel']),
    ).toEqual(ipcFailure('INVALID_REQUEST'));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('redacts rejected transport errors and validates responses', async () => {
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error('fake-secret /private/path'))
      .mockResolvedValueOnce({ ...success, secret: 'fake-secret' });
    const api = createMeetingCopilotApi(invoke);
    expect(await api.getStatus()).toEqual(ipcFailure('UNAVAILABLE'));
    expect(await api.getStatus()).toEqual(ipcFailure('INVALID_RESPONSE'));
  });

  it('times out a stalled request and ignores its late failure', async () => {
    vi.useFakeTimers();
    let rejectLate: (reason: Error) => void = () => {
      throw new Error('not started');
    };
    const api = createMeetingCopilotApi(
      () =>
        new Promise((_resolve, reject) => {
          rejectLate = reject;
        }),
    );
    const result = api.getStatus();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toEqual(ipcFailure('TIMEOUT'));
    rejectLate(new Error('late private failure'));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('supports independent concurrent read-only requests and clears timers', async () => {
    vi.useFakeTimers();
    const api = createMeetingCopilotApi(() => Promise.resolve(success));
    expect(await Promise.all([api.getStatus(), api.getStatus()])).toEqual([
      success,
      success,
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
