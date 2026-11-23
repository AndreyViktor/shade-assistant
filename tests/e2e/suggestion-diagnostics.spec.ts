import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

for (const outcome of ['authentication', 'empty'] as const) {
  test(`diagnoses a synthetic ${outcome} response without extra requests`, async () => {
    test.skip(process.platform !== 'darwin', 'Apple Local requires macOS');
    const fixture = await createTestApp({
      syntheticNative: 'suggestions',
      syntheticSuggestions: true,
      syntheticSuggestionOutcome: outcome,
    });
    const app = await fixture.launch();
    try {
      const page = await app.firstWindow();
      await page
        .getByRole('button', { name: 'Iniciar transcrição local' })
        .click();
      await page
        .getByRole('checkbox', { name: /Adicionar sugestões de IA/ })
        .check();
      await page
        .getByRole('button', { name: 'Iniciar com sugestões', exact: true })
        .click();
      const assistance = page.getByRole('region', {
        name: 'Assistência da reunião',
      });
      if (outcome === 'authentication') {
        await expect(assistance.getByRole('alert')).toContainText(
          'Falha nas sugestões',
        );
        await expect(assistance).toHaveCSS(
          'border-top-color',
          'rgb(174, 98, 107)',
        );
        await expect(
          page.getByRole('region', { name: 'Transcrição ao vivo' }),
        ).not.toHaveClass(/area-failed/);
        await page.screenshot({
          path: test.info().outputPath('suggestions-error.png'),
        });
      }
      await page
        .getByRole('button', { name: 'Preferências', exact: true })
        .click();
      const diagnostics = page.getByRole('region', {
        name: 'Estado da OpenAI',
      });
      await expect(diagnostics).toContainText(
        outcome === 'empty'
          ? 'Resposta válida, sem sugestões'
          : 'Autenticação ou acesso negado',
      );
      await diagnostics
        .getByText('Diagnóstico OpenAI', { exact: true })
        .click();
      await expect(
        diagnostics.getByText(
          `HTTP ${outcome === 'empty' ? 200 : 401} recebido`,
        ),
      ).toBeVisible();
      await diagnostics.getByText('Ver corpo da última requisição').click();
      await expect(
        diagnostics.getByLabel('Corpo da requisição OpenAI'),
      ).toContainText('Qual é o prazo do projeto fictício Aurora?');
      const publicState = await page.evaluate(async () => ({
        settings: await window.meetingCopilot.getSettings(),
        session: await window.meetingCopilot.session({
          version: 11,
          action: 'read',
        }),
        storage: { ...localStorage },
        html: document.body.innerHTML,
      }));
      expect(JSON.stringify(publicState)).not.toMatch(
        /t024-synthetic-not-a-key|private-error-sentinel/,
      );
      expect(publicState.storage).toEqual({});
      expect(
        await app.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                syntheticSuggestionRequests: unknown[];
              }
            ).syntheticSuggestionRequests.length,
        ),
      ).toBe(1);
      await page.getByRole('button', { name: 'Voltar ao painel' }).click();
      await page.getByRole('button', { name: 'Desativar sugestões' }).click();
      await expect(assistance.getByRole('alert')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Preferências', exact: true })
        .click();
      await expect(
        diagnostics.getByLabel('Corpo da requisição OpenAI'),
      ).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          window.meetingCopilot.session({ version: 11, action: 'read' }),
        ),
      ).toMatchObject({
        suggestions: { diagnostics: null, status: 'disabled' },
      });
      await page.getByRole('button', { name: 'Voltar ao painel' }).click();
      await page.getByRole('button', { name: 'Parar' }).click();
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
