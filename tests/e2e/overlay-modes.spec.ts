import type { BrowserWindow } from 'electron';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('overlay views preserve the session and reflow offline', async () => {
  test.skip(process.platform !== 'darwin', 'Apple Local requires macOS');
  const fixture = await createTestApp({
    syntheticNative: 'layout',
    syntheticSuggestions: true,
  });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    const win = await app.browserWindow(page);
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await page.getByRole('checkbox').check();
    await page.getByLabel('Limite de pedidos de sugestão').fill('1');
    await page.getByRole('button', { name: 'Iniciar com sugestões' }).click();
    await expect(
      page.getByRole('region', { name: 'Resultados estruturados da reunião' }),
    ).toContainText('Qual é o prazo do projeto Aurora?');
    await expect(page.getByText('Sugestão sintética 01')).toBeVisible();

    const read = () =>
      page.evaluate(() =>
        window.meetingCopilot.session({ version: 12, action: 'read' }),
      );
    const before = await read();
    const modes = page.getByRole('group', { name: 'Visualização do overlay' });
    const transcript = modes.getByRole('button', { name: 'Só transcrição' });
    await transcript.focus();
    await expect(transcript.locator('.overlay-mode-tooltip')).toBeVisible();
    await transcript.press('Enter');
    await expect(transcript).toBeFocused();
    await expect(transcript).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('region', { name: 'Transcrição ao vivo' }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Assistência da reunião' }),
    ).toHaveCount(0);

    const assistance = modes.getByRole('button', { name: 'Só assistência' });
    await assistance.hover();
    await expect(assistance.locator('.overlay-mode-tooltip')).toBeVisible();
    await assistance.click();
    await expect(
      page.getByRole('region', { name: 'Transcrição ao vivo' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Resultados estruturados da reunião' }),
    ).toBeVisible();
    await expect(page.getByText('Sugestão sintética 01')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Preferências' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Parar', exact: true }),
    ).toBeVisible();
    expect(await read()).toEqual(before);
    await page.screenshot({ path: test.info().outputPath('assistance.png') });

    await modes.getByRole('button', { name: 'Visualização completa' }).click();
    for (const [width, height, zoom] of [
      [960, 720, 1],
      [640, 480, 1],
      [640, 480, 1.5],
    ] as const) {
      await win.evaluate(
        (window: BrowserWindow, size) => window.setSize(...size),
        [width, height] as [number, number],
      );
      await win.evaluate(
        (window: BrowserWindow, factor) =>
          window.webContents.setZoomFactor(factor),
        zoom,
      );
      await expect
        .poll(() => page.evaluate(() => window.innerWidth))
        .toBe(Math.round(width / zoom));
      await expect(
        page.getByRole('region', { name: 'Transcrição ao vivo' }),
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Assistência da reunião' }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const columns = await page
        .locator('.meeting-workspace')
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(' ').length,
        );
      expect(columns).toBe(zoom > 1 ? 1 : 2);
      await page.screenshot({
        path: test.info().outputPath(`complete-${width}-${zoom}.png`),
      });
      expect(await read()).toEqual(before);
    }
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'demoNetworkAttempts'),
      ),
    ).toBe(0);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
