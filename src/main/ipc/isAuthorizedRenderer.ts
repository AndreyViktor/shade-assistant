import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

export function isAuthorizedRenderer(
  window: BrowserWindow,
  rendererUrl: string,
  event: IpcMainInvokeEvent,
): boolean {
  return (
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame !== null &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url === rendererUrl
  );
}
