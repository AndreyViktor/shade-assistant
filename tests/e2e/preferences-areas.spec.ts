import { expect, test } from '@playwright/test';
import type { BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import { createTestApp } from './testApp';

test('preferences areas work offline at both window sizes and high zoom', async () => {
  const fixture = await createTestApp({ denyCapture: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page
      .getByRole('button', { name: 'Preferências', exact: true })
      .click();
    const audio = page.getByRole('button', { name: /Áudio e transcrição/ });
    await expect(audio).toBeVisible();
    for (const [width, height] of [
      [960, 720],
      [640, 480],
    ] as const) {
      await app.evaluate(
        ({ BrowserWindow }, size) =>
          BrowserWindow.getAllWindows()[0]?.setContentSize(
            size.width,
            size.height,
          ),
        { width, height },
      );
      await expect(
        page.getByRole('button', { name: /Diagnóstico/ }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/t076-overview-${width}.png`,
      });
    }
    await audio.focus();
    await page.keyboard.press('Enter');
    await page.getByLabel('Idioma').selectOption('en-US');
    await expect(
      page.getByText('Alterações pendentes', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Descartar alterações' }).click();
    await expect(audio).toBeFocused();
    await expect(audio).toContainText('pt-BR');
    await audio.click();
    await page.getByLabel('Idioma').selectOption('en-US');
    await page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(page.getByText(/Nenhum serviço foi iniciado/)).toBeVisible();
    await page.getByRole('button', { name: 'Voltar às preferências' }).click();
    await expect(audio).toContainText('en-US');
    const win = await app.browserWindow(page);
    await win.evaluate((window: BrowserWindow) =>
      window.webContents.setZoomFactor(2),
    );
    await expect(
      page.getByRole('button', { name: /Diagnóstico/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.getByRole('button', { name: /Sugestões de IA/ }).click();
    await expect(page.getByLabel('Perfil padrão da reunião')).toBeVisible();
    await page
      .getByLabel('Perfil padrão da reunião')
      .selectOption('technical-review');
    await page
      .getByRole('button', { name: 'Salvar preferências' })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('button', { name: 'Salvar preferências' }),
    ).toBeInViewport();
    const zoomImage = await win.evaluate(async (window: BrowserWindow) =>
      (await window.webContents.capturePage()).toPNG().toString('base64'),
    );
    await writeFile(
      'test-results/t076-zoom.png',
      Buffer.from(zoomImage, 'base64'),
    );
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'demoNetworkAttempts'),
      ),
    ).toBe(0);
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'captureAttempts'),
      ),
    ).toBe(0);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
