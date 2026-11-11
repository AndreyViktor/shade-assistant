// @vitest-environment node
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  on: vi.fn<
    (
      name: string,
      callback: (event: { preventDefault: () => void }) => void,
    ) => void
  >(),
  quit: vi.fn(),
  cleanup: vi.fn<() => Promise<void>>(),
}));
vi.mock('electron', () => ({
  app: {
    setName: vi.fn(),
    on: mocks.on,
    quit: mocks.quit,
    whenReady: () => Promise.resolve(),
    exit: vi.fn(),
  },
}));
vi.mock('./app/createMainWindow', () => ({ createMainWindow: vi.fn() }));
vi.mock('./app/createPanelController', () => ({
  createPanelController: () => async () => {},
}));
vi.mock('./app/installApplicationMenu', () => ({
  installApplicationMenu: vi.fn(),
}));
vi.mock('./app/sessionCleanup', () => ({ cleanupSessions: mocks.cleanup }));

it('prevents quit until session cleanup settles, including repeated quit requests', async () => {
  let finish: () => void = () => {};
  mocks.cleanup.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await import('./index');
  const quit = mocks.on.mock.calls.find(
    ([name]) => name === 'before-quit',
  )?.[1];
  const event = { preventDefault: vi.fn() };
  quit?.(event);
  quit?.(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(2);
  expect(mocks.cleanup).toHaveBeenCalledOnce();
  expect(mocks.quit).not.toHaveBeenCalled();
  finish();
  await Promise.resolve();
  expect(mocks.quit).toHaveBeenCalledOnce();
  quit?.(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(2);
});
