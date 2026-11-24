// @vitest-environment node
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  READINESS_CHANNEL,
  unavailableReadiness,
} from '../../contracts/ipc/readiness';
import type {
  PermissionSettingsTarget,
  ReadinessResult,
} from '../../contracts/ipc/readiness';
import type { ReadinessService } from '../readiness/createReadinessService';
import { registerReadinessIpc } from './registerReadinessIpc';

type ReadinessListener = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<ReadinessResult>;

const { handle, removeHandler } = vi.hoisted(() => ({
  handle: vi.fn<(channel: string, listener: ReadinessListener) => void>(),
  removeHandler: vi.fn(),
}));
vi.mock('electron', () => ({ ipcMain: { handle, removeHandler } }));

describe('readiness main IPC', () => {
  beforeEach(() => vi.clearAllMocks());

  function setup() {
    const url = 'file:///app/dist/renderer/index.html';
    const frame = { url };
    const window = {
      isDestroyed: vi.fn(() => false),
      webContents: { mainFrame: frame },
      once: vi.fn<(event: string, listener: () => void) => void>(),
    };
    const service = {
      check: vi
        .fn<ReadinessService['check']>()
        .mockResolvedValue(unavailableReadiness('helper-missing')),
      openSettings: vi
        .fn<ReadinessService['openSettings']>()
        .mockResolvedValue(undefined),
    } satisfies ReadinessService;
    registerReadinessIpc(window as unknown as BrowserWindow, url, service);
    const listener = handle.mock.calls.at(-1)?.[1];
    if (!listener) throw new Error('handler missing');
    const event = {
      sender: window.webContents,
      senderFrame: frame,
    } as unknown as IpcMainInvokeEvent;
    return {
      window,
      service,
      listener,
      event,
    };
  }

  it('checks and opens only an allowlisted pane without invoking capture', async () => {
    const { event, listener, service } = setup();
    expect(await listener(event, { version: 1, action: 'check' })).toEqual({
      version: 1,
      ok: true,
      action: 'check',
      readiness: unavailableReadiness('helper-missing'),
    });
    expect(
      await listener(event, {
        version: 1,
        action: 'open-settings',
        target: 'screen-recording' satisfies PermissionSettingsTarget,
      }),
    ).toEqual({
      version: 1,
      ok: true,
      action: 'open-settings',
      target: 'screen-recording',
    });
    expect(service.openSettings).toHaveBeenCalledExactlyOnceWith(
      'screen-recording',
    );
  });

  it('rejects foreign frames, arbitrary targets and transport failures', async () => {
    const { event, listener, service } = setup();
    expect(
      await listener(
        {
          ...event,
          senderFrame: { url: event.senderFrame?.url },
        } as unknown as IpcMainInvokeEvent,
        {
          version: 1,
          action: 'check',
        },
      ),
    ).toMatchObject({ ok: false, code: 'FORBIDDEN' });
    expect(
      await listener(event, {
        version: 1,
        action: 'open-settings',
        target: 'arbitrary',
      }),
    ).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    service.check.mockRejectedValue(new Error('/private/synthetic'));
    expect(
      await listener(event, { version: 1, action: 'check' }),
    ).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
  });

  it('removes its fixed handler when the window closes', () => {
    const { window } = setup();
    expect(handle.mock.calls.at(-1)?.[0]).toBe(READINESS_CHANNEL);
    window.once.mock.calls[0]?.[1]();
    expect(removeHandler).toHaveBeenCalledExactlyOnceWith(READINESS_CHANNEL);
  });

  it('rejects a response when the window is destroyed during a check', async () => {
    const { window, service, listener, event } = setup();
    service.check.mockImplementation(() => {
      window.isDestroyed.mockReturnValue(true);
      return Promise.resolve(unavailableReadiness('helper-missing'));
    });
    expect(
      await listener(event, { version: 1, action: 'check' }),
    ).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});
