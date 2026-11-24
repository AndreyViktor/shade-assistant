import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createTestApp } from './testApp';

test('reuses a safe default profile, supports session overrides and clears runtime focus', async () => {
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
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Preferências' }).click();
    await page.getByRole('button', { name: /Sugestões de IA/ }).click();
    await page.getByLabel('Perfil padrão da reunião').selectOption('status');
    await page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(
      page
        .getByRole('region', { name: 'Sugestões de IA', exact: true })
        .getByRole('status')
        .filter({ hasText: 'Preferências e estado da chave atualizados' }),
    ).toContainText('Nenhum serviço foi iniciado');
    await page.getByRole('button', { name: 'Voltar às preferências' }).click();
    await page.getByRole('button', { name: 'Voltar ao painel' }).click();

    const requests = () =>
      app.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              syntheticSuggestionRequests: unknown[];
            }
          ).syntheticSuggestionRequests,
      );
    const open = async () => {
      await page
        .getByRole('button', { name: 'Iniciar transcrição local' })
        .click();
      await page
        .getByRole('checkbox', { name: /Adicionar sugestões de IA/ })
        .check();
      await page.getByLabel('Limite de pedidos de sugestão').fill('1');
    };

    await open();
    const profile = page.getByLabel('Perfil da reunião');
    await expect(profile).toHaveValue('status');
    await profile.selectOption('discovery');
    await expect(profile).toHaveAccessibleDescription(
      /Entender necessidades, contexto e critérios de sucesso/,
    );
    await expect(profile).toHaveAccessibleDescription(
      /não comprova o que foi dito/,
    );
    await profile.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath('meeting-profile-discovery.png'),
    });
    await page.getByRole('button', { name: 'Iniciar com sugestões' }).click();
    await expect.poll(async () => (await requests()).length).toBe(1);
    expect(profileInput((await requests())[0])).toMatchObject({
      id: 'discovery',
      objective: 'Entender necessidades, contexto e critérios de sucesso.',
    });

    await page.getByRole('button', { name: 'Desativar sugestões' }).click();
    await expect(
      page.getByText(/Sugestões e resultados ao vivo desativados/),
    ).toBeVisible();
    expect(await sessionJson(page)).not.toContain('discovery');
    expect(await page.locator('body').innerHTML()).not.toContain(
      'Entender necessidades, contexto e critérios de sucesso.',
    );
    await page.getByRole('button', { name: 'Parar', exact: true }).click();

    await open();
    await expect(profile).toHaveValue('status');
    await page.getByRole('button', { name: 'Iniciar com sugestões' }).click();
    await expect.poll(async () => (await requests()).length).toBe(2);
    expect(profileInput((await requests())[1])).toMatchObject({
      id: 'status',
      objective: 'Clarificar progresso, bloqueios e próximos passos.',
    });
    await page.getByRole('button', { name: 'Parar', exact: true }).click();
    expect(await sessionJson(page)).not.toContain('meetingProfile');

    const stored = await readFile(
      join(fixture.profile, 'preferences.v1.json'),
      'utf8',
    );
    expect(JSON.parse(stored)).toMatchObject({ meetingProfile: 'status' });
    expect(stored).not.toMatch(/Entender necessidades|Clarificar progresso/);
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

function profileInput(value: unknown): unknown {
  const body = value as { input?: { content?: { text?: string }[] }[] };
  const text = body.input?.[0]?.content?.[0]?.text ?? '{}';
  return (JSON.parse(text) as { meetingProfile?: unknown }).meetingProfile;
}

async function sessionJson(page: Page): Promise<string> {
  return JSON.stringify(
    await page.evaluate(() =>
      window.meetingCopilot.session({ version: 11, action: 'read' }),
    ),
  );
}
