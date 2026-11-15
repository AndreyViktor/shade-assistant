import type { BrowserWindow } from 'electron';
import { writeFile } from 'node:fs/promises';
import type { JSHandle, Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

// Playwright screenshots crop Electron's viewport at native zoom. Capture only
// the fixture window through Electron, keeping its actual pixels and scale.
async function captureWindow(
  win: JSHandle<BrowserWindow>,
  page: Page,
  name: string,
) {
  // Geometry updates before the compositor paints a programmatic scroll.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  const png = await win.evaluate(async (window: BrowserWindow) =>
    (await window.webContents.capturePage()).toPNG().toString('base64'),
  );
  await writeFile(test.info().outputPath(name), Buffer.from(png, 'base64'));
}

// Home/End may animate both nested panes and the document. Wait until all
// scrolling settles before Tab, so the earlier key cannot move the next focus.
async function settleScroll(page: Page) {
  let previous = '';
  let stable = 0;
  await expect
    .poll(
      async () => {
        const current = await page.evaluate(() =>
          JSON.stringify([
            window.scrollY,
            ...Array.from(
              document.querySelectorAll('*'),
              (element) => element.scrollTop,
            ),
          ]),
        );
        stable = current === previous ? stable + 1 : 0;
        previous = current;
        return stable;
      },
      { intervals: [100] },
    )
    .toBeGreaterThanOrEqual(3);
}

// A paragraph can exceed the viewport. Check its actual first/last glyph against
// the viewport and every scrolling ancestor instead of demanding the whole text.
async function expectVisibleBounds(locator: Locator, edge?: 'start' | 'end') {
  await expect
    .poll(() =>
      locator.evaluate((element, textEdge) => {
        let rect = element.getBoundingClientRect();
        if (textEdge) {
          const node = element.firstChild;
          if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent)
            return false;
          const range = document.createRange();
          const offset = textEdge === 'end' ? node.textContent.length - 1 : 0;
          range.setStart(node, offset);
          range.setEnd(node, offset + 1);
          rect = range.getBoundingClientRect();
        }
        let top = 0,
          left = 0,
          right = window.innerWidth,
          bottom = window.innerHeight;
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          const bounds = parent.getBoundingClientRect();
          if (style.overflowY !== 'visible') {
            top = Math.max(top, bounds.top);
            bottom = Math.min(bottom, bounds.bottom);
          }
          if (style.overflowX !== 'visible') {
            left = Math.max(left, bounds.left);
            right = Math.min(right, bounds.right);
          }
        }
        const target = document.elementFromPoint(
          (rect.left + rect.right) / 2,
          (rect.top + rect.bottom) / 2,
        );
        const visible =
          Boolean(target && element.contains(target)) &&
          rect.top >= top - 1 &&
          rect.bottom <= bottom + 1 &&
          rect.left >= left - 1 &&
          rect.right <= right + 1;
        return visible
          ? 'visible'
          : JSON.stringify({
              rect: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
              },
              top,
              left,
              right,
              bottom,
              hit: target?.tagName,
              scroll: window.scrollY,
            });
      }, edge),
    )
    .toBe('visible');
}

test('active meeting keeps preferences reachable and all panes usable at 200% zoom', async () => {
  test.skip(process.platform !== 'darwin', 'Apple Local requires macOS');
  const fixture = await createTestApp({
    syntheticNative: 'layout',
    syntheticSuggestions: true,
  });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.name));
    const win = (await app.browserWindow(page)) as JSHandle<BrowserWindow>;
    const preferences = page.getByRole('button', {
      name: 'Preferências',
      exact: true,
    });
    const read = () =>
      page.evaluate(() =>
        window.meetingCopilot.session({ version: 8, action: 'read' }),
      );
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await page.getByRole('checkbox').check();
    await page.getByLabel('Limite de pedidos de sugestão').fill('1');
    await page.getByRole('button', { name: 'Iniciar com sugestões' }).click();
    const log = page.getByRole('log', { name: 'Falas recentes' });
    const assistance = page.getByRole('region', {
      name: 'Assistência da reunião',
    });
    await expect(log.locator('.transcript-segment')).toHaveCount(8);
    await expect(assistance.getByRole('article')).toHaveCount(2);
    const before = await read();

    for (const width of [960, 640]) {
      await win.evaluate(
        (window: BrowserWindow, size) => window.setSize(...size),
        [width, width === 960 ? 720 : 480] as [number, number],
      );
      await expect
        .poll(() => page.evaluate(() => window.innerWidth))
        .toBe(width);
      // Check before click/focus can silently scroll a clipped footer into view.
      await expect(preferences).toBeInViewport({ ratio: 1 });
      await preferences.click({ trial: true });
      await captureWindow(win, page, `active-${width}.png`);
      await preferences.click();
      await expect(
        page.getByRole('button', { name: 'Voltar ao painel' }),
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(preferences).toBeFocused();
      expect(await read()).toEqual(before);
    }

    await win.evaluate((window: BrowserWindow) =>
      window.webContents.setZoomFactor(2),
    );
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(320);
    await log.focus();
    await log.press('Home');
    await settleScroll(page);
    await expect
      .poll(() => log.evaluate((element) => element.scrollTop))
      .toBe(0);
    await log.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expectVisibleBounds(
      log.locator('.transcript-segment').first().locator('p').last(),
      'start',
    );
    await captureWindow(win, page, 'zoom-transcript-start.png');
    await log.press('End');
    await settleScroll(page);
    await expect
      .poll(() =>
        log.evaluate((element) =>
          Math.abs(
            element.scrollHeight - element.clientHeight - element.scrollTop,
          ),
        ),
      )
      .toBeLessThanOrEqual(1);
    // A long utterance exceeds the viewport: verify its tail after reaching End.
    await expect(
      log.locator('.transcript-segment').last().locator('p').last(),
    ).toBeInViewport();
    await log.evaluate((element) => element.scrollIntoView({ block: 'end' }));
    await expectVisibleBounds(
      log.locator('.transcript-segment').last().locator('p').last(),
      'end',
    );
    await captureWindow(win, page, 'zoom-transcript-end.png');
    await page.keyboard.press('Tab');
    await expect(assistance).toBeFocused();
    await assistance.press('Home');
    await settleScroll(page);
    // Home also moves the outer document on macOS; bring this pane back into view.
    await assistance.evaluate((element) =>
      element.scrollIntoView({ block: 'start' }),
    );
    await expect
      .poll(() => assistance.evaluate((element) => element.scrollTop))
      .toBe(0);
    await expect(
      assistance.getByRole('article').first().getByRole('heading'),
    ).toBeInViewport({ ratio: 1 });
    await captureWindow(win, page, 'zoom-suggestions-start.png');
    for (const dismiss of await assistance
      .getByRole('button', { name: /Descartar/ })
      .all()) {
      await page.keyboard.press('Tab');
      await expect(dismiss).toBeFocused();
      await captureWindow(
        win,
        page,
        `zoom-dismiss-${await dismiss.getAttribute('aria-label')}.png`,
      );
      // Verify geometry through all clipping ancestors and hit-test the
      // rendered control after keyboard navigation.
      try {
        await expectVisibleBounds(dismiss);
      } catch (error) {
        await captureWindow(win, page, 'zoom-dismiss-failure.png');
        throw error;
      }
    }
    await page.keyboard.press('Tab');
    await expect(
      page.getByText('Quando os cartões são removidos?'),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Desativar sugestões' }),
    ).toBeFocused();
    await captureWindow(win, page, 'zoom-suggestions-end.png');
    await page.keyboard.press('Tab');
    await expect(preferences).toBeFocused();
    await expectVisibleBounds(preferences);
    await captureWindow(win, page, 'zoom-preferences-access.png');
    await page.keyboard.press('Enter');
    await captureWindow(win, page, 'zoom-settings-top.png');

    for (const name of [
      'Fonte de áudio',
      'Fornecedor de transcrição',
      'Idioma',
      'Fornecedor de sugestões',
      'Modelo para as sugestões',
    ]) {
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('combobox', { name, exact: true }),
      ).toBeFocused();
      await expectVisibleBounds(
        page.getByRole('combobox', { name, exact: true }),
      );
    }
    await captureWindow(win, page, 'zoom-settings-model.png');
    await page.getByRole('button', { name: 'Salvar preferências' }).focus();
    await expectVisibleBounds(
      page.getByRole('button', { name: 'Salvar preferências' }),
    );
    const privacy = page.getByRole('region', {
      name: 'Permissões e privacidade',
    });
    await privacy.locator('p').last().scrollIntoViewIfNeeded();
    await expectVisibleBounds(privacy.locator('p').last());
    await captureWindow(win, page, 'zoom-settings-privacy.png');
    const demo = page.getByText('Diagnóstico · DEMO offline');
    await demo.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Iniciar DEMO' }),
    ).toBeDisabled();
    const unavailable = page.getByText(
      'Pare a transcrição no painel antes de iniciar a DEMO.',
    );
    await unavailable.scrollIntoViewIfNeeded();
    await expectVisibleBounds(unavailable);
    await captureWindow(win, page, 'zoom-settings-diagnostics.png');
    expect(await read()).toEqual(before);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(preferences).toBeFocused();
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(assistance.getByRole('article')).toHaveCount(0);
    await captureWindow(win, page, 'zoom-paused.png');
    const paused = await read();
    await preferences.click();
    await page.keyboard.press('Escape');
    expect(await read()).toEqual(paused);
    await page.getByRole('button', { name: 'Retomar', exact: true }).click();
    await page.getByRole('button', { name: 'Parar', exact: true }).click();
    await expect(log.locator('.transcript-segment')).toHaveCount(0);
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'demoNetworkAttempts'),
      ),
    ).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});

test('consent content and actions remain reachable at 200% zoom without capture', async () => {
  const fixture = await createTestApp({ denyCapture: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    const win = (await app.browserWindow(page)) as JSHandle<BrowserWindow>;
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await captureWindow(win, page, 'consent.png');
    await win.evaluate((window: BrowserWindow) => {
      window.setSize(640, 480);
      window.webContents.setZoomFactor(2);
    });
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(320);
    const toggle = page.getByRole('checkbox');
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Space');
    await page.getByLabel('Limite de pedidos de sugestão').focus();
    await expect(
      page.getByLabel('Limite de pedidos de sugestão'),
    ).toBeInViewport({ ratio: 1 });
    await captureWindow(win, page, 'zoom-consent-limit.png');
    const disclosure = page.locator('.cloud-consent');
    await disclosure.evaluate((element) =>
      element.scrollIntoView({ block: 'start' }),
    );
    await expectVisibleBounds(disclosure, 'start');
    await captureWindow(win, page, 'zoom-consent-disclosure-start.png');
    // The disclosure is taller than this zoomed scroll area; both ends must be reachable.
    await page.locator('.consent-content').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await disclosure.evaluate((element) =>
      element.scrollIntoView({ block: 'end' }),
    );
    await expectVisibleBounds(disclosure, 'end');
    await captureWindow(win, page, 'zoom-consent-disclosure.png');
    await expect(
      page.getByRole('button', { name: 'Iniciar com sugestões' }),
    ).toBeDisabled();
    const local = page.getByRole('button', {
      name: 'Iniciar apenas a transcrição',
    });
    await local.focus();
    // Native zoom rounds a subpixel edge (observed ratio 0.9945).
    await expect(local).toBeInViewport({ ratio: 0.99 });
    await captureWindow(win, page, 'zoom-consent-actions.png');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Cancelar', exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Cancelar', exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Iniciar transcrição local' }),
    ).toBeFocused();
    expect(
      await app.evaluate(() => ({
        capture: Reflect.get(globalThis, 'captureAttempts') as unknown,
        network: Reflect.get(globalThis, 'demoNetworkAttempts') as unknown,
      })),
    ).toEqual({ capture: 0, network: 0 });
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
