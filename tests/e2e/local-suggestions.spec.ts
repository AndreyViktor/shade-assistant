import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

for (const { consent, model } of [
  { consent: false, model: 'gpt-5.4-mini' },
  { consent: true, model: 'gpt-5.4-mini' },
  { consent: true, model: 'gpt-5.4' },
]) {
  test(`synthetic JSONL → context → mock Responses → overlay; text consent ${consent}; ${model}`, async () => {
    test.skip(
      process.platform !== 'darwin',
      'Apple Local selection requires macOS',
    );
    const fixture = await createTestApp({
      denyNetwork: true,
      syntheticNative: 'suggestions',
      syntheticSuggestions: true,
    });
    const app = await fixture.launch();
    try {
      const page = await app.firstWindow();
      await page
        .getByRole('button', { name: 'Iniciar transcrição local' })
        .click();
      const checkbox = page.getByRole('checkbox', {
        name: /Adicionar sugestões de IA/,
      });
      await expect(checkbox).not.toBeChecked();
      if (consent) {
        await page.screenshot({
          path: test.info().outputPath('start-local.png'),
        });
        await checkbox.check();
        const modelSelect = page.getByRole('combobox', {
          name: 'Modelo para as sugestões',
        });
        await expect(modelSelect).toHaveValue('gpt-5.4-mini');
        await expect(page.getByRole('textbox')).toHaveCount(0);
        await modelSelect.selectOption(model);
        await modelSelect.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: test.info().outputPath('start-suggestions.png'),
        });
      }
      await page
        .getByRole('button', {
          name: consent ? 'Iniciar com sugestões' : 'Iniciar transcrição',
          exact: true,
        })
        .click();
      await expect(
        page
          .getByRole('log')
          .getByText('Qual é o prazo do projeto fictício Aurora?'),
      ).toBeVisible();
      const cards = page.getByRole('region', { name: 'Sugestões da reunião' });
      if (consent) {
        await expect(cards.getByRole('article')).toHaveCount(1);
        await expect(cards).toContainText('Prazo sintético Aurora');
        await expect(cards).not.toContainText('DEMO');
        await expect(page.getByText(/Limite atingido/)).toBeVisible();
        const diagnostics = page.getByRole('region', {
          name: 'Estado da OpenAI',
        });
        await diagnostics
          .getByText('Diagnóstico OpenAI', { exact: true })
          .click();
        await expect(diagnostics.getByText('HTTP 200 recebido')).toBeVisible();
        await diagnostics.getByText('Ver corpo da última requisição').click();
        const sentBody = diagnostics.getByLabel('Corpo da requisição OpenAI');
        const observed = JSON.parse(await sentBody.innerText()) as unknown;
        const transported = await app.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                syntheticSuggestionRequests: unknown[];
              }
            ).syntheticSuggestionRequests[0],
        );
        expect(observed).toEqual(transported);
        expect(await page.locator('body').innerText()).not.toContain(
          't024-synthetic-not-a-key',
        );
        await sentBody.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: test.info().outputPath('openai-diagnostics.png'),
        });
        await cards
          .getByRole('button', { name: 'Descartar: Prazo sintético Aurora' })
          .click();
        await expect(cards.getByRole('article')).toHaveCount(0);
        await page.getByRole('button', { name: 'Pausar' }).click();
        await expect(sentBody).toHaveCount(0);
        await page.getByRole('button', { name: 'Retomar' }).click();
        await page.getByRole('button', { name: 'Desativar sugestões' }).click();
        await expect(cards).toHaveCount(0);
        const snapshot = await page.evaluate(() =>
          window.meetingCopilot.session({ version: 5, action: 'read' }),
        );
        expect(snapshot).toMatchObject({
          session: {
            phase: 'running',
            consent: { context: false, capture: true },
          },
          suggestions: { status: 'disabled' },
        });
      } else {
        await page.waitForTimeout(1200);
        await expect(cards).toHaveCount(0);
      }
      const requests = await app.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              syntheticSuggestionRequests: unknown[];
            }
          ).syntheticSuggestionRequests,
      );
      expect(requests).toHaveLength(consent ? 1 : 0);
      if (consent) {
        expect(requests[0]).toMatchObject({
          model,
          store: false,
          max_output_tokens: 2048,
        });
        const body = JSON.stringify(requests[0]);
        expect(body).toContain('Qual é o prazo do projeto fictício Aurora?');
        expect(body).not.toMatch(
          /input_audio|input_image|sessionId|segmentId|Bearer/,
        );
      }
      await page.getByRole('button', { name: 'Parar' }).click();
      expect(
        await page.evaluate(() =>
          window.meetingCopilot.session({ version: 5, action: 'read' }),
        ),
      ).toMatchObject({
        local: null,
        suggestions: { items: [], status: 'disabled' },
      });
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
