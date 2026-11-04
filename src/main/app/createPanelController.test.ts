// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { createPanelController } from './createPanelController';

const getAllWindows = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows } }));

function fakeWindow() {
  return {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  };
}

describe('panel activation', () => {
  beforeEach(() => getAllWindows.mockReturnValue([]));

  it('restores and focuses an existing minimized panel without creating another', async () => {
    const window = fakeWindow();
    window.isMinimized.mockReturnValue(true);
    getAllWindows.mockReturnValue([window]);
    const create = vi.fn();
    await createPanelController(create)();
    expect(create).not.toHaveBeenCalled();
    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent opening and recreates after closing', async () => {
    const window = fakeWindow();
    const create = vi.fn().mockResolvedValue(window);
    const show = createPanelController(create);
    await Promise.all([show(), show()]);
    expect(create).toHaveBeenCalledOnce();
    expect(window.restore).not.toHaveBeenCalled();
    await show();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not touch a window destroyed during opening', async () => {
    const window = fakeWindow();
    window.isDestroyed.mockReturnValue(true);
    await createPanelController(vi.fn().mockResolvedValue(window))();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
  });

  it('reports opening failure and allows a later retry', async () => {
    const create = vi
      .fn<() => Promise<BrowserWindow>>()
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValue(fakeWindow() as unknown as BrowserWindow);
    const show = createPanelController(create);
    await expect(show()).rejects.toThrow('load failed');
    await expect(show()).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(2);
  });
});
