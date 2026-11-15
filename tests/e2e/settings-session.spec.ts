import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('settings navigation preserves a running and paused session; saved choices require fresh consent', async () => {
  test.skip(process.platform !== 'darwin', 'Apple Local requires macOS');
  const fixture = await createTestApp({
    syntheticNative: 'suggestions',
    syntheticSuggestions: true,
  });
  const app = await test.step('launch Electron', () => fixture.launch());
  try {
    const page = await test.step('open panel', () => app.firstWindow());
    const read = () =>
      page.evaluate(() =>
        window.meetingCopilot.session({ version: 8, action: 'read' }),
      );
    const open = () =>
      page.getByRole('button', { name: 'Preferências', exact: true }).click();
    const back = page.getByRole('button', { name: 'Voltar ao painel' });
    await expect(
      page.getByRole('region', { name: 'Preferências', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await page.getByRole('checkbox').check();
    await page.getByLabel('Limite de pedidos de sugestão').fill('1');
    await page
      .getByRole('button', { name: 'Iniciar com sugestões', exact: true })
      .click();
    const cards = page.getByRole('region', { name: 'Sugestões da reunião' });
    await expect(cards.getByRole('article')).toHaveCount(1);
    const before = await read();
    expect(before).toMatchObject({
      session: { phase: 'running' },
      local: { config: { locale: 'pt-BR', sources: ['mic', 'system'] } },
      suggestions: {
        remainingRequests: 0,
        diagnostics: { model: 'gpt-5.4-mini', maxRequests: 1 },
      },
    });

    await open();
    await expect(back).toBeFocused();
    await page.getByText('Diagnóstico · DEMO offline').click();
    await expect(
      page.getByRole('button', { name: 'Iniciar DEMO' }),
    ).toBeDisabled();
    await expect(
      page.getByText('Pare a transcrição no painel antes de iniciar a DEMO.'),
    ).toBeVisible();
    await page.getByText('Diagnóstico · DEMO offline').click();
    await expect(page.getByRole('log')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pausar' })).toHaveCount(0);
    await page
      .locator('#panel-settings')
      .getByLabel('Idioma')
      .selectOption('en-US');
    await page.getByLabel('Fonte de áudio').selectOption('mic');
    await page.getByLabel('Modelo para as sugestões').selectOption('gpt-5.4');
    await page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(page.getByText(/Nenhum serviço foi iniciado/)).toBeVisible();
    expect(await read()).toEqual(before);
    await page.screenshot({
      path: 'test-results/settings-session.png',
      fullPage: true,
    });
    await back.click();
    await expect(
      page.getByRole('button', { name: 'Preferências', exact: true }),
    ).toBeFocused();
    await expect(cards.getByRole('article')).toHaveCount(1);
    expect(await read()).toEqual(before);
    await page.getByRole('button', { name: 'Pausar' }).click();
    const paused = await read();
    await open();
    await page.getByLabel('Fonte de áudio').selectOption('system');
    await page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(page.getByText(/Nenhum serviço foi iniciado/)).toBeVisible();
    expect(await read()).toEqual(paused);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Retomar' })).toBeVisible();
    expect(await read()).toEqual(paused);
    await page.getByRole('button', { name: 'Parar' }).click();

    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Inglês (EUA)');
    await expect(dialog.locator('.capture-summary')).toContainText(
      'áudio do sistema',
    );
    await expect(dialog.locator('.capture-summary')).not.toContainText(
      'microfone',
    );
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await page.getByRole('checkbox').check();
    await expect(dialog).toContainText('GPT-5.4 —');
    await expect(page.getByLabel('Limite de pedidos de sugestão')).toHaveValue(
      '10',
    );
    await page
      .getByRole('button', { name: 'Iniciar apenas a transcrição' })
      .click();
    await expect.poll(read).toMatchObject({
      session: {
        phase: 'running',
        consent: { capture: true, context: false, remoteAudio: false },
      },
      local: { config: { locale: 'en-US', sources: ['system'] } },
      suggestions: { status: 'disabled', diagnostics: null },
    });
    await page.getByRole('button', { name: 'Parar' }).click();
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'demoNetworkAttempts'),
      ),
    ).toBe(0);
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'syntheticSuggestionRequests'),
      ),
    ).toMatchObject([{ model: 'gpt-5.4-mini' }]);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
