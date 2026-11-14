import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('loads a development .env without passing its secrets to renderer or process environment', async () => {
  const fixture = await createTestApp();
  const synthetic = 'synthetic-env-file-not-an-api-credential';
  await writeFile(
    join(fixture.directory, '.env'),
    `OPENAI_API_KEY="${synthetic}"\nCOPILOT_ENV_TEST=must-not-be-exported\n`,
    { mode: 0o600 },
  );
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page
      .getByRole('button', { name: 'Preferências', exact: true })
      .click();
    await page
      .getByText('Chave OpenAI (não usada na transcrição local)')
      .click();
    await expect(
      page.getByText('carregada de .env ou OPENAI_API_KEY no desenvolvimento', {
        exact: false,
      }),
    ).toBeVisible();
    const state = await page.evaluate(async () => ({
      settings: await window.meetingCopilot.getSettings(),
      storage: { ...localStorage },
      html: document.body.innerHTML,
    }));
    expect(state.settings).toMatchObject({
      ok: true,
      settings: { credential: 'development' },
    });
    expect(JSON.stringify(state)).not.toContain(synthetic);
    expect(state.storage).toEqual({});
    expect(
      await app.evaluate(() =>
        Boolean(process.env.OPENAI_API_KEY || process.env.COPILOT_ENV_TEST),
      ),
    ).toBe(false);
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'demoNetworkAttempts'),
      ),
    ).toBe(0);
    await expect(
      readFile(join(fixture.profile, 'openai-key.enc')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});

for (const version of [1, 2]) {
  test(`migrates v${version} and persists preferences across Electron restarts without network or renderer secrets`, async () => {
    const fixture = await createTestApp();
    await mkdir(fixture.profile, { recursive: true });
    await writeFile(
      join(fixture.profile, 'preferences.v1.json'),
      JSON.stringify({
        version,
        ...(version === 2
          ? { suggestionProvider: 'openai', suggestionModel: 'gpt-5.4' }
          : {}),
        mode: 'real',
        sttProvider: 'apple-local',
        language: 'pt-BR',
      }),
    );
    let app = await fixture.launch();
    try {
      let page = await app.firstWindow();
      await page
        .getByRole('button', { name: 'Preferências', exact: true })
        .click();
      const outgoing: string[] = [];
      page.on('request', (request) => {
        if (/^https?:/.test(request.url())) outgoing.push(request.url());
      });
      await page
        .locator('#panel-settings')
        .getByLabel('Idioma')
        .selectOption('en-US');
      await expect(page.getByLabel('Fonte de áudio')).toHaveValue('both');
      await page.getByLabel('Fonte de áudio').selectOption('system');
      await page.getByLabel('Modelo para as sugestões').selectOption('gpt-5.4');
      await page.getByRole('button', { name: 'Salvar preferências' }).click();
      await expect(
        page
          .getByRole('region', { name: 'Preferências', exact: true })
          .getByRole('status')
          .filter({ hasText: 'Nenhum serviço foi iniciado' }),
      ).toContainText('Nenhum serviço foi iniciado');
      expect(outgoing).toEqual([]);
      expect(
        JSON.parse(
          await readFile(join(fixture.profile, 'preferences.v1.json'), 'utf8'),
        ),
      ).toEqual({
        version: 3,
        audioSource: 'system',
        mode: 'real',
        sttProvider: 'apple-local',
        language: 'en-US',
        suggestionProvider: 'openai',
        suggestionModel: 'gpt-5.4',
      });
      await app.close();
      app = await fixture.launch();
      page = await app.firstWindow();
      await page
        .getByRole('button', { name: 'Preferências', exact: true })
        .click();
      await expect(
        page.locator('#panel-settings').getByLabel('Idioma'),
      ).toHaveValue('en-US');
      await expect(page.getByLabel('Modelo para as sugestões')).toHaveValue(
        'gpt-5.4',
      );
      await expect(page.getByLabel('Fonte de áudio')).toHaveValue('system');
      const state = await page.evaluate(async () => ({
        settings: await window.meetingCopilot.getSettings(),
        storage: { ...localStorage },
        inputs: document.querySelectorAll('input[type="password"]').length,
      }));
      expect(state).toMatchObject({
        settings: { ok: true, settings: { credential: 'missing' } },
        storage: {},
        inputs: 0,
      });
      expect(
        await page.evaluate((): unknown =>
          Reflect.apply(window.meetingCopilot.importSecret, null, [
            '/private/arbitrary',
          ]),
        ),
      ).toEqual({ version: 1, ok: false, code: 'INVALID_REQUEST' });
      expect(
        await readFile(join(fixture.profile, 'preferences.v1.json'), 'utf8'),
      ).not.toContain('key');
      await page
        .getByRole('heading', { name: 'Preferências', exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: 'test-results/settings.png',
        fullPage: true,
      });
    } finally {
      await app.close();
      await fixture.cleanup();
    }
  });
}

test('Mac SecretStore uses real OS encryption for a synthetic value; renderer sees metadata only', async () => {
  test.skip(process.platform !== 'darwin', 'Mac Keychain integration only');
  const fixture = await createTestApp();
  const input = join(fixture.directory, 'synthetic-key.txt');
  const synthetic = 'synthetic-not-an-api-credential-T004';
  await writeFile(input, synthetic, { mode: 0o600 });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page
      .getByRole('button', { name: 'Preferências', exact: true })
      .click();
    await page
      .getByText('Chave OpenAI (não usada na transcrição local)')
      .click();
    // Simulate only the file selection; safeStorage and the product's storage/IPC are real.
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = () =>
        Promise.resolve({ canceled: false, filePaths: [path] });
    }, input);
    await page.getByRole('button', { name: 'Importar chave' }).click();
    await expect(page.getByText(/armazenada no cofre do Mac/)).toBeVisible();
    const ciphertext = await readFile(join(fixture.profile, 'openai-key.enc'));
    expect(ciphertext.includes(Buffer.from(synthetic))).toBe(false);
    const roundtrip = await app.evaluate(
      async ({ safeStorage }, { encrypted, expected }) => {
        const value = await safeStorage.decryptStringAsync(
          Buffer.from(encrypted),
        );
        return value.result === expected;
      },
      { encrypted: [...ciphertext], expected: synthetic },
    );
    expect(roundtrip).toBe(true);
    const publicState = await page.evaluate(async () => ({
      settings: await window.meetingCopilot.getSettings(),
      storage: { ...localStorage },
      html: document.body.innerHTML,
    }));
    expect(JSON.stringify(publicState)).not.toContain(synthetic);
    expect(publicState.storage).toEqual({});
    await page.getByRole('button', { name: 'Remover chave' }).click();
    await expect(page.getByText(/não configurada/)).toBeVisible();
    await expect(
      readFile(join(fixture.profile, 'openai-key.enc')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
