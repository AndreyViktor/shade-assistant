import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

const sentinel =
  'T053_CONTEXT_SYNTHETIC: esclarecer riscos; meu papel é designer.';

async function expectNoContextOnDisk(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await expectNoContextOnDisk(path);
    else if (entry.isFile())
      expect((await readFile(path)).includes(Buffer.from(sentinel))).toBe(
        false,
      );
  }
}

for (const filled of [false, true]) {
  test(`optional context, deliberate empty response and cleanup; filled=${filled}`, async () => {
    test.skip(
      process.platform !== 'darwin',
      'Apple Local selection requires macOS',
    );
    const fixture = await createTestApp({
      syntheticNative: 'suggestions',
      syntheticSuggestions: true,
      syntheticSuggestionOutcome: 'empty',
    });
    const app = await fixture.launch();
    const logs: string[] = [];
    app
      .process()
      .stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
    app
      .process()
      .stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
    try {
      const page = await app.firstWindow();
      page.on('console', (message) => logs.push(message.text()));
      const open = async () => {
        await page
          .getByRole('button', { name: 'Iniciar transcrição local' })
          .click();
        await page
          .getByRole('checkbox', { name: /Adicionar sugestões de IA/ })
          .check();
      };
      await open();
      const field = page.getByRole('textbox', {
        name: 'Contexto da reunião (opcional)',
      });
      await field.fill(sentinel);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await open();
      await expect(field).toHaveValue('');
      if (filled) await field.fill(sentinel);
      await expect(field).toHaveAttribute('maxlength', '2000');
      await expect(field).toHaveAccessibleDescription(
        /enviado separado da transcrição/,
      );
      await field.focus();
      await page.keyboard.press('Tab');
      await expect(
        page.getByLabel('Limite de pedidos de sugestão'),
      ).toBeFocused();
      await page.getByLabel('Limite de pedidos de sugestão').fill('1');
      await field.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: test.info().outputPath('optional-context.png'),
      });
      await page
        .getByRole('button', { name: 'Iniciar com sugestões', exact: true })
        .click();
      const requests = () =>
        app.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                syntheticSuggestionRequests: unknown[];
              }
            ).syntheticSuggestionRequests,
        );
      await expect.poll(async () => (await requests()).length).toBe(1);
      const body = (await requests())[0] as {
        input: { content: { text: string }[] }[];
      };
      const data = JSON.parse(body.input[0]?.content[0]?.text ?? '{}') as {
        userContext?: string;
        recent: unknown[];
        summary: unknown[];
      };
      expect(data.userContext).toBe(filled ? sentinel : undefined);
      expect(JSON.stringify(data.recent)).not.toContain(sentinel);
      expect(JSON.stringify(data.summary)).not.toContain(sentinel);
      await page
        .getByRole('button', { name: 'Preferências', exact: true })
        .click();
      await expect(
        page.getByText('Resposta válida, sem sugestões'),
      ).toBeVisible();
      await page.getByText('Diagnóstico OpenAI', { exact: true }).click();
      await page.getByText('Ver corpo da última requisição').click();
      if (filled)
        await expect(
          page.getByLabel('Corpo da requisição OpenAI'),
        ).toContainText(sentinel);
      await page.getByRole('button', { name: 'Voltar ao painel' }).click();
      await expect(
        page
          .getByRole('region', { name: 'Sugestões da reunião' })
          .getByRole('article'),
      ).toHaveCount(0);
      await page.getByRole('button', { name: 'Desativar sugestões' }).click();
      await expect(
        page.getByText(
          'Sugestões e resultados ao vivo desativados. A transcrição continua disponível neste painel.',
          { exact: true },
        ),
      ).toBeVisible();
      const state = await page.evaluate(async () => ({
        session: await window.meetingCopilot.session({
          version: 10,
          action: 'read',
        }),
        settings: await window.meetingCopilot.getSettings(),
        local: { ...localStorage },
        temporary: { ...sessionStorage },
        html: document.body.innerHTML,
      }));
      expect(JSON.stringify(state)).not.toContain(sentinel);
      expect(state.session).toMatchObject({
        session: { phase: 'running' },
        suggestions: { status: 'disabled', diagnostics: null },
      });
      expect(state.local).toEqual({});
      expect(state.temporary).toEqual({});
      expect(await requests()).toHaveLength(1);
      await page.getByRole('button', { name: 'Parar', exact: true }).click();
      await open();
      await expect(field).toHaveValue('');
      await page
        .getByRole('button', { name: 'Iniciar com sugestões', exact: true })
        .click();
      await expect.poll(async () => (await requests()).length).toBe(2);
      expect(JSON.stringify((await requests())[1])).not.toContain(sentinel);
      await page.getByRole('button', { name: 'Parar', exact: true }).click();
      expect(
        JSON.stringify(
          await page.evaluate(() =>
            window.meetingCopilot.session({ version: 10, action: 'read' }),
          ),
        ),
      ).not.toContain(sentinel);
      expect(
        await app.evaluate(
          () =>
            (globalThis as typeof globalThis & { demoNetworkAttempts: number })
              .demoNetworkAttempts,
        ),
      ).toBe(0);
    } finally {
      await app.close();
      try {
        expect(logs.join('\n')).not.toContain(sentinel);
        await expectNoContextOnDisk(fixture.profile);
      } finally {
        await fixture.cleanup();
      }
    }
  });
}
