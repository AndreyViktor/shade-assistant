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
    expect(Object.keys(api)).toEqual([
      'getStatus',
      'getSettings',
      'savePreferences',
      'importSecret',
      'removeSecret',
    ]);
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

describe('settings preload boundary', () => {
  const preferences = {
    version: 1 as const,
    mode: 'demo' as const,
    sttProvider: 'apple-local' as const,
    language: 'pt-BR' as const,
  };
  const success = {
    version: 1,
    ok: true,
    settings: { preferences, credential: 'missing' },
  };
  it('uses fixed settings actions and validates replies', async () => {
    const invoke = vi.fn().mockResolvedValue(success);
    const api = createMeetingCopilotApi(invoke);
    expect(await api.getSettings()).toEqual(success);
    expect(await api.savePreferences(preferences)).toEqual(success);
    expect(await api.importSecret()).toEqual(success);
    expect(await api.removeSecret()).toEqual(success);
    expect(invoke.mock.calls).toEqual([
      ['meeting-copilot:settings', { version: 1, action: 'read' }],
      ['meeting-copilot:settings', { version: 1, action: 'save', preferences }],
      ['meeting-copilot:settings', { version: 1, action: 'import-secret' }],
      ['meeting-copilot:settings', { version: 1, action: 'remove-secret' }],
    ]);
    invoke.mockResolvedValue({ ...success, secret: 'synthetic' });
    expect(await api.getSettings()).toEqual(ipcFailure('INVALID_RESPONSE'));
  });
  it('blocks paths, secret values, extra args and invalid preferences before IPC', async () => {
    const invoke = vi.fn();
    const api = createMeetingCopilotApi(invoke);
    for (const method of [
      api.getSettings,
      api.importSecret,
      api.removeSecret,
    ]) {
      expect(await Reflect.apply(method, null, ['/private/key'])).toEqual(
        ipcFailure('INVALID_REQUEST'),
      );
    }
    expect(
      await Reflect.apply(api.savePreferences, null, [
        { ...preferences, key: 'synthetic' },
      ]),
    ).toEqual(ipcFailure('INVALID_REQUEST'));
    expect(
      await Reflect.apply(api.savePreferences, null, [preferences, 'extra']),
    ).toEqual(ipcFailure('INVALID_REQUEST'));
    expect(invoke).not.toHaveBeenCalled();
  });
  it('redacts errors and times out stalled settings reads', async () => {
    const invoke = vi.fn().mockRejectedValueOnce(new Error('synthetic-secret'));
    const api = createMeetingCopilotApi(invoke);
    expect(await api.getSettings()).toEqual(ipcFailure('UNAVAILABLE'));
    vi.useFakeTimers();
    invoke.mockReturnValue(new Promise(() => {}));
    const result = api.getSettings();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toEqual(ipcFailure('TIMEOUT'));
    expect(vi.getTimerCount()).toBe(0);
  });
});
