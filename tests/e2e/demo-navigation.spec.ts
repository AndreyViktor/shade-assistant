import type { BrowserWindow } from 'electron';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('DEMO stays in diagnostics across preferences, keyboard navigation and session cleanup', async () => {
  const fixture = await createTestApp({ denyCapture: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.name));
    const read = () =>
      page.evaluate(() =>
        window.meetingCopilot.session({ version: 12, action: 'read' }),
      );
    const preferences = page.getByRole('button', {
      name: 'Preferências',
      exact: true,
    });
    const back = page.getByRole('button', { name: 'Voltar ao painel' });
    const diagnostic = page.getByText('Diagnóstico · DEMO offline');
    await expect(
      page.getByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeEnabled();
    await expect(diagnostic).toHaveCount(0);
    await page.screenshot({
      path: 'test-results/t043-panel.png',
      fullPage: true,
    });
    await preferences.focus();
    await page.keyboard.press('Enter');
    await expect(back).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Iniciar DEMO' }),
    ).toHaveCount(0);
    const idle = await read();
    await page.getByRole('button', { name: /Diagnóstico/ }).click();
    await diagnostic.focus();
    await page.keyboard.press('Enter');
    const start = page.getByRole('button', { name: 'Iniciar DEMO' });
    await start.focus();
    await expect(start).toBeFocused();
    expect(await read()).toEqual(idle);
    await page.keyboard.press('Space');
    const preview = page.getByRole('region', { name: 'Roteiro DEMO' });
    // The first simulated turn has no suggestion; the next card arrives after
    // two transcript stages and two suggestion stages (six seconds total).
    await expect(preview.getByRole('article')).toHaveCount(1, {
      timeout: 12000,
    });
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    const paused = await read();
    expect(paused).toMatchObject({
      session: {
        mode: 'demo',
        phase: 'paused',
        consent: { capture: false, context: false, remoteAudio: false },
      },
      local: null,
      suggestions: { status: 'disabled' },
    });
    await page.getByRole('button', { name: 'Voltar às preferências' }).click();
    await page.getByRole('button', { name: /Áudio e transcrição/ }).click();
    await page
      .locator('#panel-settings')
      .getByLabel('Idioma')
      .selectOption('en-US');
    await page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(page.getByText(/Nenhum serviço foi iniciado/)).toBeVisible();
    await page.getByRole('button', { name: 'Voltar às preferências' }).click();
    await page.getByRole('button', { name: /Sugestões de IA/ }).click();
    await page.getByLabel('Modelo para as sugestões').selectOption('gpt-5.4');
    await page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(page.getByText(/Nenhum serviço foi iniciado/)).toBeVisible();
    expect(await read()).toEqual(paused);
    await page.screenshot({
      path: 'test-results/t043-diagnostics.png',
      fullPage: true,
    });

    await page.getByRole('button', { name: 'Voltar às preferências' }).click();
    await page.getByRole('button', { name: /Diagnóstico/ }).click();
    const nativeWindow = await app.browserWindow(page);
    await nativeWindow.evaluate((win: BrowserWindow) => {
      win.setSize(640, 480);
      win.webContents.setZoomFactor(2);
    });
    const resume = page.getByRole('button', { name: 'Retomar' });
    await resume.focus();
    await expect(resume).toBeInViewport();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Parar', exact: true }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: 'test-results/t043-diagnostics-zoom.png',
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(preferences).toBeFocused();
    await expect(
      page.getByRole('heading', { name: 'DEMO · simulação offline' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Iniciar transcrição local' }),
    ).toHaveCount(0);
    await expect(preview).toHaveCount(0);
    expect(await read()).toEqual(paused);
    await nativeWindow.evaluate((win: BrowserWindow) => {
      win.webContents.setZoomFactor(1);
      win.setSize(960, 720);
    });
    await page.screenshot({
      path: 'test-results/t043-demo-active.png',
      fullPage: true,
    });
    await preferences.click();
    await page.getByRole('button', { name: /Diagnóstico/ }).click();
    await expect(preview.getByRole('article')).toHaveCount(1);
    await resume.click();
    await expect(
      page.getByRole('status').filter({ hasText: /^Em andamento$/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Voltar às preferências' }).click();
    await back.click();
    await page.getByRole('button', { name: 'Parar DEMO', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeEnabled();
    expect(await read()).toMatchObject({
      session: { phase: 'stopped' },
      demo: { transcript: null, suggestions: [], completed: false },
    });
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await expect(page.getByRole('alertdialog')).toContainText('Inglês (EUA)');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await preferences.click();
    await page.getByRole('button', { name: /Diagnóstico/ }).click();
    await start.click();
    await expect(preview.getByText('Aguardando fala simulada…')).toBeVisible();
    await page.getByRole('button', { name: 'Parar', exact: true }).click();
    expect(
      await app.evaluate(() => ({
        capture: Reflect.get(globalThis, 'captureAttempts') as unknown,
        network: Reflect.get(globalThis, 'demoNetworkAttempts') as unknown,
      })),
    ).toEqual({ capture: 0, network: 0 });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
