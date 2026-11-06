import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('plays deterministic demo transcription and suggestions without credentials or network', async () => {
  const fixture = await createTestApp({ denyNetwork: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page.getByText('Testar a demonstração').click();
    const start = page.getByRole('button', { name: 'Iniciar DEMO' });
    await expect(start).toBeEnabled();
    expect(
      await page.evaluate(() => window.meetingCopilot.getSettings()),
    ).toMatchObject({ ok: true, settings: { credential: 'missing' } });
    expect(await app.evaluate(() => 'OPENAI_API_KEY' in process.env)).toBe(
      false,
    );
    await start.click();
    const preview = page.getByRole('region', { name: 'Roteiro DEMO' });
    await expect(
      preview.getByText('Vamos revisar a migração do módulo de relatórios.'),
    ).toBeVisible();
    await expect(
      preview.getByText(/Fonte simulada: microfone · pt-BR/),
    ).toBeVisible();
    await expect(
      preview.getByText('Nenhuma sugestão neste momento.'),
    ).toBeVisible();
    await expect(
      preview.getByText('Que riscos precisamos avaliar antes da migração?'),
    ).toBeVisible();
    await expect(
      preview.getByText(/Fonte simulada: sistema · pt-BR/),
    ).toBeVisible();
    await expect(
      preview.getByText(/Pergunte quais dependências/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pausar' }).click();
    const paused = await page.evaluate(() =>
      window.meetingCopilot.session({ version: 2, action: 'read' }),
    );
    await expect(preview.getByText(/Roteiro pausado/)).toBeVisible();
    await page.screenshot({ path: 'test-results/demo.png' });
    // Deliberately wait beyond a complete stage to verify real timer cancellation.
    await page.waitForTimeout(3200);
    expect(
      await page.evaluate(() =>
        window.meetingCopilot.session({ version: 2, action: 'read' }),
      ),
    ).toEqual(paused);
    await page.getByRole('button', { name: 'Retomar' }).click();
    await expect(preview.getByText(/Confirme quem acompanhará/)).toBeVisible();
    await expect(preview.getByText(/Roteiro concluído/)).toBeVisible();
    await page.getByRole('button', { name: 'Parar' }).click();
    await expect(preview).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        window.meetingCopilot.session({ version: 2, action: 'read' }),
      ),
    ).toMatchObject({
      demo: { transcript: null, suggestions: [], completed: false },
    });
    await start.click();
    await expect(
      preview.getByText('Vamos revisar a migração do módulo de relatórios.'),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
    await expect(preview).toHaveCount(0);
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
