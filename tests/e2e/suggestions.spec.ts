import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('shows two DEMO cards, dismisses by keyboard and expires the remaining card while paused', async () => {
  test.setTimeout(60000);
  const fixture = await createTestApp({ denyNetwork: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Iniciar DEMO' }).click();
    const cards = page.getByRole('region', { name: 'Sugestões DEMO' });
    await expect(cards.getByRole('article')).toHaveCount(2, { timeout: 15000 });
    await expect(cards.getByText('Pergunta · DEMO')).toBeVisible();
    await expect(cards.getByText('Ação · DEMO')).toBeVisible();
    await page.getByRole('button', { name: 'Pausar' }).click();
    await cards.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/suggestions.png' });
    const dismiss = cards.getByRole('button', {
      name: 'Descartar: Esclareça as dependências',
    });
    await dismiss.focus();
    await expect(dismiss).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(cards.getByRole('article')).toHaveCount(1);
    await expect(
      cards.getByRole('article', { name: 'Combine o acompanhamento' }),
    ).toBeVisible();
    // Real main-process wall clock: the renderer must keep refreshing during pause.
    await expect(cards.getByRole('article')).toHaveCount(0, { timeout: 35000 });
    await expect(
      cards.getByText('Nenhuma sugestão neste momento.'),
    ).toBeVisible();
    await expect(page.getByText('Pausada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retomar' }).click();
    await expect(cards.getByRole('article')).toHaveCount(0);
    await page.getByRole('button', { name: 'Parar' }).click();
    await expect(cards).toHaveCount(0);
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
