import { BrowserWindow } from 'electron';

// Activation and the menu can arrive together while the renderer is loading.
export function createPanelController(
  createWindow: () => Promise<BrowserWindow>,
) {
  let opening: Promise<BrowserWindow> | undefined;

  return async function showPanel(): Promise<void> {
    let window = BrowserWindow.getAllWindows()[0];
    if (opening || !window) {
      opening ??= createWindow();
      try {
        window = await opening;
      } finally {
        opening = undefined;
      }
    }
    if (window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };
}
