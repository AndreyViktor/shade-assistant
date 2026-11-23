import type { BrowserWindow } from 'electron';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

for (const empty of [false, true]) {
  test(`meeting columns: ${empty ? 'empty state' : 'long speech and retained cards'}`, async () => {
    test.skip(process.platform !== 'darwin', 'Apple Local requires macOS');
    const fixture = await createTestApp({
      syntheticNative: empty ? 'silent' : 'layout',
      syntheticSuggestions: true,
    });
    const app = await fixture.launch();
    try {
      const page = await app.firstWindow();
      const nativeWindow = await app.browserWindow(page);
      await page
        .getByRole('button', { name: 'Iniciar transcrição local' })
        .click();
      await page
        .getByRole('checkbox', { name: /Adicionar sugestões de IA/ })
        .check();
      await page.getByLabel('Limite de pedidos de sugestão').fill('1');
      await page
        .getByRole('button', { name: 'Iniciar com sugestões', exact: true })
        .click();
      const log = page.getByRole('log', { name: 'Falas recentes' });
      const assistance = page.getByRole('region', {
        name: 'Assistência da reunião',
      });
      const suggestionRegion = assistance.getByRole('region', {
        name: 'Sugestões da reunião',
      });
      const cards = suggestionRegion.getByRole('article');
      const cardList = suggestionRegion.getByRole('list', {
        name: 'Lista rolável de cartões da reunião',
      });
      await expect(log).toBeVisible();
      await expect(cards).toHaveCount(empty ? 0 : 8);
      if (empty) {
        await expect(
          page.getByText('Nenhuma fala exibida nesta sessão.'),
        ).toBeVisible();
        await expect(
          page.getByText('Nenhuma sugestão neste momento.'),
        ).toBeVisible();
      } else await expect(log.locator('.transcript-segment')).toHaveCount(8);
      const read = () =>
        page.evaluate(() =>
          window.meetingCopilot.session({ version: 11, action: 'read' }),
        );
      const before = await read();
      for (const [width, height] of [
        [960, 720],
        [640, 480],
        [960, 720],
      ] as const) {
        await nativeWindow.evaluate(
          (win: BrowserWindow, size) => win.setSize(...size),
          [width, height] as [number, number],
        );
        await expect
          .poll(() => page.evaluate(() => window.innerWidth))
          .toBe(width);
        await page.locator('.meeting-workspace').scrollIntoViewIfNeeded();
        const left = await log.boundingBox();
        const right = await assistance.boundingBox();
        if (!left || !right) throw new Error('Missing columns');
        expect(left.x + left.width).toBeLessThan(right.x);
        expect(left.width).toBeGreaterThan(200);
        expect(right.width).toBeGreaterThan(220);
        await expect(log).toBeInViewport();
        await expect(assistance).toBeInViewport();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        for (const pane of [log, assistance]) {
          expect(
            await pane.evaluate(
              (element) => element.scrollWidth <= element.clientWidth,
            ),
          ).toBe(true);
          await pane.focus();
          await expect(pane).toBeFocused();
        }
        await expect(cards).toHaveCount(empty ? 0 : 8);
        expect(await read()).toEqual(before);
        if (!empty) {
          await expect(cardList.locator('article').first()).toHaveAttribute(
            'aria-label',
            'Sugestão sintética 08',
          );
          await expect(cardList.locator('article').last()).toHaveAttribute(
            'aria-label',
            'Sugestão sintética 01',
          );
          expect(
            await cardList.evaluate(
              (element) => element.scrollHeight > element.clientHeight,
            ),
          ).toBe(true);
          await cardList.focus();
          await cardList.press('End');
          await expect
            .poll(() => cardList.evaluate((element) => element.scrollTop))
            .toBeGreaterThan(0);
          await cardList.press('Home');
          await expect
            .poll(() => cardList.evaluate((element) => element.scrollTop))
            .toBe(0);
          await log.evaluate((element) => {
            element.scrollTop = 0;
          });
          // Position older speech before exercising keyboard scrolling.
          await expect
            .poll(() => log.evaluate((element) => element.scrollTop))
            .toBe(0);
          await log.focus();
          await expect(log).toBeFocused();
          await log.press('PageDown');
          await expect
            .poll(() => log.evaluate((element) => element.scrollTop))
            .toBeGreaterThan(0);
          await assistance.focus();
          await assistance.press('End');
          await expect
            .poll(() =>
              assistance.evaluate((element) =>
                Math.abs(
                  element.scrollHeight -
                    element.clientHeight -
                    element.scrollTop,
                ),
              ),
            )
            .toBeLessThanOrEqual(1);
          for (const pane of [log, assistance]) {
            await pane.press('Home');
            await expect
              .poll(() => pane.evaluate((element) => element.scrollTop))
              .toBe(0);
          }
        }
        await page.screenshot({
          path: test
            .info()
            .outputPath(`meeting-${empty ? 'empty' : 'long'}-${width}.png`),
        });
      }
      await nativeWindow.evaluate((win: BrowserWindow) => {
        win.setSize(640, 480);
        win.webContents.setZoomFactor(2);
      });
      await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(320);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(cards).toHaveCount(empty ? 0 : 8);
      await assistance.focus();
      await expect(assistance).toBeFocused();
      const revoke = page.getByRole('button', { name: 'Desativar sugestões' });
      await revoke.scrollIntoViewIfNeeded();
      await expect(revoke).toBeInViewport();
      expect(await read()).toEqual(before);
      await nativeWindow.evaluate((win: BrowserWindow) => {
        win.webContents.setZoomFactor(1);
        win.setSize(960, 720);
      });
      const originalPosition = await nativeWindow.evaluate(
        (win: BrowserWindow) => win.getPosition(),
      );
      await nativeWindow.evaluate((win: BrowserWindow) => {
        const [x, y] = win.getPosition();
        if (x === undefined || y === undefined)
          throw new Error('Missing window position');
        win.setPosition(x + 20, y + 20);
      });
      await expect
        .poll(() =>
          nativeWindow.evaluate((win: BrowserWindow) => win.getPosition()),
        )
        .not.toEqual(originalPosition);
      expect(await read()).toEqual(before);
      if (!empty) {
        await cards
          .last()
          .getByRole('button', { name: /Descartar/ })
          .focus();
        await page.keyboard.press('Enter');
        await expect(cards).toHaveCount(7);
      }
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await expect(cards).toHaveCount(0);
      await page.getByRole('button', { name: 'Retomar', exact: true }).click();
      await expect(cards).toHaveCount(0);
      await page.getByRole('button', { name: 'Parar', exact: true }).click();
      await expect(log).toBeVisible();
      await expect(log.locator('.transcript-segment')).toHaveCount(0);
      expect(
        await app.evaluate(
          () =>
            (globalThis as typeof globalThis & { demoNetworkAttempts: number })
              .demoNetworkAttempts,
        ),
      ).toBe(0);
    } finally {
      await app.close();
      await fixture.cleanup();
    }
  });
}
