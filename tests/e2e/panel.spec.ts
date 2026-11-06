import { writeFile } from 'node:fs/promises';
import type { BrowserWindow } from 'electron';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('floating panel supports keyboard controls, resize, zoom and restoration', async () => {
  const fixture = await createTestApp();
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeVisible();
    const nativeWindow = await app.browserWindow(page);
    expect(
      await nativeWindow.evaluate((win: BrowserWindow) => ({
        floating: win.isAlwaysOnTop(),
        minimizable: win.isMinimizable(),
        resizable: win.isResizable(),
        size: win.getSize(),
        minimum: win.getMinimumSize(),
      })),
    ).toEqual({
      floating: true,
      minimizable: true,
      resizable: true,
      size: [440, 640],
      minimum: [360, 400],
    });

    const toggle = page.getByRole('button', {
      name: 'Preferências',
      exact: true,
    });
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('.secondary-mode summary')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.privacy-details summary')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      await toggle.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      ),
    ).toBe('solid');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(
      page.locator('#panel-settings').getByLabel('Idioma'),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(
      page.locator('#panel-settings').getByLabel('Idioma'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao painel' }).click();
    await expect(toggle).toBeFocused();
    await page.screenshot({ path: 'test-results/panel.png' });

    // The installed native menu remains the source of keyboard accelerators.
    expect(
      await app.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        return {
          minimize: menu?.getMenuItemById('minimize')?.accelerator,
          show: menu?.getMenuItemById('show-panel')?.accelerator,
        };
      }),
    ).toEqual({
      minimize: 'CommandOrControl+M',
      show: 'CommandOrControl+Shift+M',
    });
    await app.evaluate(({ app }) => app.focus({ steal: true }));
    await nativeWindow.evaluate((win: BrowserWindow) => win.focus());
    await expect
      .poll(() =>
        nativeWindow.evaluate((win: BrowserWindow) => win.isFocused()),
      )
      .toBe(true);
    // CDP/sendInputEvent target the web page, not Cocoa menu key equivalents.
    // Validate the registered accelerator above and dispatch its real menu handler here.
    await app.evaluate(({ Menu, BrowserWindow }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById('minimize');
      if (!item) throw new Error('Missing minimize menu item');
      Reflect.apply(item.click, item, [
        item,
        BrowserWindow.getFocusedWindow(),
        {},
      ]);
    });
    await expect
      .poll(() =>
        nativeWindow.evaluate((win: BrowserWindow) => win.isMinimized()),
      )
      .toBe(true);
    // Restore via the real application-menu callback (no synthetic OS-wide keystrokes).
    await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById('show-panel');
      if (!item) throw new Error('Missing show panel menu item');
      Reflect.apply(item.click, item, []);
    });
    await expect
      .poll(() =>
        nativeWindow.evaluate((win: BrowserWindow) => win.isMinimized()),
      )
      .toBe(false);
    await expect
      .poll(() =>
        nativeWindow.evaluate((win: BrowserWindow) => win.isFocused()),
      )
      .toBe(true);
    expect(app.windows()).toHaveLength(1);

    await nativeWindow.evaluate((win: BrowserWindow) => win.setSize(360, 400));
    await nativeWindow.evaluate((win: BrowserWindow) =>
      win.webContents.setZoomFactor(2),
    );
    await toggle.click();
    await page
      .getByRole('button', { name: 'Salvar preferências' })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('button', { name: 'Salvar preferências' }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const zoomImage = await nativeWindow.evaluate(async (win: BrowserWindow) =>
      (await win.webContents.capturePage()).toPNG().toString('base64'),
    );
    await writeFile(
      'test-results/panel-zoom.png',
      Buffer.from(zoomImage, 'base64'),
    );
    await page.getByRole('button', { name: 'Voltar ao painel' }).click();
    await expect(toggle).toBeFocused();
    await nativeWindow.evaluate((win: BrowserWindow) =>
      win.webContents.setZoomFactor(1),
    );

    if (process.platform === 'darwin') {
      const [reopened] = await Promise.all([
        app.waitForEvent('window'),
        app.evaluate(async ({ app, BrowserWindow }) => {
          const panel = BrowserWindow.getAllWindows()[0];
          if (!panel) throw new Error('Missing panel');
          await new Promise<void>((resolve) => {
            panel.once('closed', resolve);
            panel.close();
          });
          app.emit('activate');
        }),
      ]);
      await expect(
        reopened.getByRole('heading', { name: 'Meeting Copilot', exact: true }),
      ).toBeVisible();
      await expect(
        reopened.getByRole('button', { name: 'Iniciar transcrição local' }),
      ).toBeVisible();
      expect(app.windows()).toHaveLength(1);
    }
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
