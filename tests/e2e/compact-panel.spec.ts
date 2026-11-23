import type { BrowserWindow } from 'electron';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('compact idle panel supports keyboard and resize without capture or network', async () => {
  const fixture = await createTestApp({ denyCapture: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    const win = await app.browserWindow(page);
    const start = page.getByRole('button', {
      name: 'Iniciar transcrição local',
    });
    const preferences = page.getByRole('button', {
      name: 'Preferências',
      exact: true,
    });
    const left = page.getByRole('region', { name: 'Transcrição ao vivo' });
    const right = page.getByRole('region', { name: 'Assistência da reunião' });
    await expect(start).toBeEnabled();
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.locator('html')).toHaveCSS(
      'background-color',
      'rgb(16, 24, 39)',
    );
    for (const width of [960, 640]) {
      await win.evaluate(
        (window: BrowserWindow, size) => window.setSize(...size),
        [width, width === 960 ? 720 : 480] as [number, number],
      );
      await expect
        .poll(() => page.evaluate(() => window.innerWidth))
        .toBe(width);
      const a = await left.boundingBox();
      const b = await right.boundingBox();
      if (!a || !b) throw new Error('Missing columns');
      expect(a.x + a.width).toBeLessThan(b.x);
      for (const element of [left, right, start, preferences])
        await expect(element).toBeInViewport({ ratio: 1 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`idle-${width}.png`),
      });
    }
    await start.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('log')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(right).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(preferences).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Voltar ao painel' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(preferences).toBeFocused();
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(start).toBeFocused();
    expect(
      await page.evaluate(() =>
        window.meetingCopilot.session({ version: 9, action: 'read' }),
      ),
    ).toMatchObject({
      session: { phase: 'idle', consent: { capture: false, context: false } },
      local: null,
    });
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'captureAttempts'),
      ),
    ).toBe(0);
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

test('native failure marks only transcription and exposes safe details in preferences', async () => {
  test.skip(process.platform !== 'darwin', 'Apple Local requires macOS');
  const fixture = await createTestApp({ syntheticNative: 'failure' });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await page
      .getByRole('button', { name: 'Iniciar transcrição', exact: true })
      .click();
    const left = page.getByRole('region', { name: 'Transcrição ao vivo' });
    await expect(left.getByRole('alert')).toContainText('Falha na transcrição');
    await expect(left).toHaveCSS('border-top-color', 'rgb(174, 98, 107)');
    await expect(
      page.getByRole('region', { name: 'Assistência da reunião' }),
    ).not.toHaveClass(/area-failed/);
    await expect(
      page.getByText('A captura de áudio falhou.', { exact: false }),
    ).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath('transcription-error.png'),
    });
    await page
      .getByRole('button', { name: 'Preferências', exact: true })
      .click();
    const details = page.getByRole('region', { name: 'Estado da transcrição' });
    await expect(details).toContainText('A captura de áudio falhou.');
    await details.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath('transcription-details.png'),
    });
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Preferências', exact: true }),
    ).toBeFocused();
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
