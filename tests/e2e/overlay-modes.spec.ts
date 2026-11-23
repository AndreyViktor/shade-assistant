import type { BrowserWindow } from 'electron';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('overlay modes preserve capture, consent, focus and content across resize', async () => {
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

    const read = () =>
      page.evaluate(() =>
        window.meetingCopilot.session({ version: 11, action: 'read' }),
      );
    const before = await read();
    const modes = page.getByRole('group', { name: 'Modo do overlay' });
    const compact = modes.getByRole('button', { name: 'Compacto' });
    await compact.focus();
    await compact.press('Enter');
    await expect(compact).toBeFocused();
    await expect(compact).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(/Captura ativa/)).toBeVisible();

    for (const [mode, width, region] of [
      ['Só transcrição', 640, 'Transcrição ao vivo'],
      ['Só resultados', 960, 'Resultados da reunião'],
    ] as const) {
      await modes.getByRole('button', { name: mode }).click();
      await win.evaluate(
        (window: BrowserWindow, size) => window.setSize(...size),
        [width, width === 640 ? 480 : 720] as [number, number],
      );
      await expect
        .poll(() => page.evaluate(() => window.innerWidth))
        .toBe(width);
      await expect(page.getByRole('region', { name: region })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`${mode}-${width}.png`),
      });
      expect(await read()).toEqual(before);
    }

    await modes.getByRole('button', { name: 'Ocultar conteúdo' }).click();
    const hidden = page.getByRole('region', {
      name: 'Overlay temporariamente oculto',
    });
    await expect(hidden).toContainText('Captura ativa');
    await expect(hidden).toContainText('pode aparecer em compartilhamentos');
    await expect(
      page.getByRole('button', { name: 'Preferências' }),
    ).toHaveCount(0);
    const restore = page.getByRole('button', { name: 'Restaurar conteúdo' });
    await expect(restore).toBeFocused();
    await page.screenshot({
      path: test.info().outputPath('conteudo-oculto.png'),
    });
    await restore.press('Enter');
    const results = page.getByRole('button', { name: 'Só resultados' });
    await expect(results).toBeFocused();
    await expect(results).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('region', { name: 'Resultados da reunião' }),
    ).toContainText('Qual é o prazo do projeto Aurora?');
    expect(await read()).toEqual(before);

    expect(
      await win.evaluate((window: BrowserWindow) => ({
        floating: window.isAlwaysOnTop(),
        workspaces: window.isVisibleOnAllWorkspaces(),
        resizable: window.isResizable(),
      })),
    ).toEqual({ floating: true, workspaces: true, resizable: true });
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
