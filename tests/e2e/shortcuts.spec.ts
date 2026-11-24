import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('configures and restores registered shortcuts offline', async () => {
  const fixture = await createTestApp({ denyCapture: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page
      .getByRole('button', { name: 'Preferências', exact: true })
      .click();
    await page.getByRole('button', { name: /Atalhos globais/ }).click();
    await expect(page.getByText('Atalhos ativos.')).toBeVisible();
    expect(
      await app.evaluate(({ globalShortcut }) =>
        globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F12'),
      ),
    ).toBe(true);
    await page
      .getByLabel('Pedir ajuda')
      .selectOption('CommandOrControl+Alt+Shift+F8');
    await page.getByRole('button', { name: 'Aplicar atalhos' }).click();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect
      .poll(() =>
        app.evaluate(({ globalShortcut }) =>
          globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F8'),
        ),
      )
      .toBe(true);
    expect(
      await app.evaluate(({ globalShortcut }) =>
        globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F12'),
      ),
    ).toBe(false);
    await page.getByRole('button', { name: 'Restaurar padrões' }).click();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect
      .poll(() =>
        app.evaluate(({ globalShortcut }) =>
          globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F12'),
        ),
      )
      .toBe(true);
    await page.getByRole('button', { name: 'Voltar às preferências' }).click();
    await page.getByRole('button', { name: 'Voltar ao painel' }).click();
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await page
      .getByRole('checkbox', { name: /Adicionar sugestões de IA/ })
      .check();
    await page.getByLabel('Contexto da reunião (opcional)').focus();
    await expect
      .poll(() =>
        app.evaluate(({ globalShortcut }) =>
          globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F12'),
        ),
      )
      .toBe(false);
    await page
      .getByRole('checkbox', { name: /Adicionar sugestões de IA/ })
      .focus();
    await expect
      .poll(() =>
        app.evaluate(({ globalShortcut }) =>
          globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F12'),
        ),
      )
      .toBe(true);
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
