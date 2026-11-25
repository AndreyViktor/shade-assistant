import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BrowserWindow } from 'electron';
import { createTestApp } from './testApp';

test('uses a fresh session focus and clears it on stop', async () => {
  test.skip(
    process.platform !== 'darwin',
    'Apple Local selection requires macOS',
  );
  const fixture = await createTestApp({
    syntheticNative: 'suggestions',
    syntheticSuggestions: true,
    syntheticSuggestionOutcome: 'empty',
  });
  await mkdir(fixture.profile, { recursive: true });
  await writeFile(
    join(fixture.profile, 'preferences.v1.json'),
    JSON.stringify({
      version: 4,
      audioSource: 'both',
      mode: 'real',
      sttProvider: 'apple-local',
      language: 'pt-BR',
      suggestionProvider: 'openai',
      suggestionModel: 'gpt-5.4-mini',
      meetingProfile: 'status',
    }),
  );
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Preferências' }).click();
    await page.getByRole('button', { name: /Sugestões de IA/ }).click();
    await expect(page.getByLabel('Perfil padrão da reunião')).toHaveCount(0);
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

    const start = page.getByRole('button', {
      name: 'Iniciar transcrição local',
    });
    await start.click();
    await expect(
      page.getByRole('group', { name: 'Foco do assistente' }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page
      .getByRole('checkbox', { name: /Adicionar sugestões de IA/ })
      .check();
    await page.getByRole('radio', { name: /Verificação de vídeos/ }).check();
    await expect(
      page.getByRole('button', { name: 'Iniciar com sugestões' }),
    ).toBeDisabled();
    await page
      .getByRole('checkbox', { name: /Autorizo consultas na web/ })
      .check();
    await expect(
      page.getByRole('button', { name: 'Iniciar com sugestões' }),
    ).toBeEnabled();
    await page.getByRole('radio', { name: /Status/ }).check();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.setContentSize(640, 480),
    );
    const window = await app.browserWindow(page);
    await window.evaluate((win: BrowserWindow) =>
      win.webContents.setZoomFactor(2),
    );
    for (const target of [
      page.getByRole('radio', { name: /Revisão técnica/ }),
      page.getByLabel('Contexto da reunião (opcional)'),
      page.getByLabel('Limite de pedidos de sugestão'),
      page.getByText(/Ao iniciar com sugestões, você autoriza/),
      page.getByRole('button', { name: 'Iniciar com sugestões' }),
    ]) {
      await target.scrollIntoViewIfNeeded();
      await expect(target).toBeInViewport();
    }
    expect(
      await page
        .locator('.consent-content')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await window.evaluate((win: BrowserWindow) =>
      win.webContents.setZoomFactor(1),
    );
    expect((await requests()).length).toBe(0);
    await page.keyboard.press('Escape');
    await expect(start).toBeFocused();

    await open();
    const none = page.getByRole('radio', { name: /Sem perfil/ });
    await expect(none).toBeChecked();
    await none.focus();
    await page.keyboard.press('ArrowDown');
    const discovery = page.getByRole('radio', { name: /Descoberta/ });
    await expect(discovery).toBeChecked();
    await expect(discovery).toBeFocused();
    await expect(
      page.getByText(/Entender necessidades, contexto e critérios de sucesso/),
    ).toBeVisible();
    await discovery.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath('meeting-profile-discovery.png'),
    });
    await page.getByRole('button', { name: 'Iniciar com sugestões' }).click();
    await expect.poll(async () => (await requests()).length).toBe(1);
    expect(profileInput((await requests())[0])).toMatchObject({
      id: 'discovery',
      objective: 'Entender necessidades, contexto e critérios de sucesso.',
    });

    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await page.getByRole('button', { name: 'Retomar', exact: true }).click();
    await page.getByRole('button', { name: 'Desativar sugestões' }).click();
    await expect(
      page.getByRole('heading', { name: 'Sugestões desativadas' }),
    ).toBeVisible();
    expect(await sessionJson(page)).not.toContain('discovery');
    expect(await page.locator('body').innerHTML()).not.toContain(
      'Entender necessidades, contexto e critérios de sucesso.',
    );
    await page.getByRole('button', { name: 'Parar', exact: true }).click();

    await open();
    await expect(none).toBeChecked();
    await page.getByRole('button', { name: 'Iniciar com sugestões' }).click();
    await expect.poll(async () => (await requests()).length).toBe(2);
    expect(profileInput((await requests())[1])).toBeUndefined();
    await page.getByRole('button', { name: 'Parar', exact: true }).click();
    expect(await sessionJson(page)).not.toContain('meetingProfile');

    const stored = await readFile(
      join(fixture.profile, 'preferences.v1.json'),
      'utf8',
    );
    expect(JSON.parse(stored)).toMatchObject({
      version: 5,
      audioSource: 'both',
      suggestionModel: 'gpt-5.4-mini',
    });
    expect(JSON.parse(stored)).not.toHaveProperty('meetingProfile');
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
      window.meetingCopilot.session({ version: 12, action: 'read' }),
    ),
  );
}
