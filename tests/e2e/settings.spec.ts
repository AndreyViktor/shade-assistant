import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('persists preferences across real Electron restarts without network or renderer secrets', async () => {
  const fixture = await createTestApp();
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
    await expect(page.getByLabel('Provedor STT preferido')).toHaveValue(
      process.platform === 'darwin' ? 'apple-local' : 'mock',
    );
    await page.getByLabel('Modo preferido').selectOption('real');
    await page.getByLabel('Idiomas preferidos').selectOption('pt-BR+en-US');
    await page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Nenhum serviço foi iniciado',
    );
    expect(outgoing).toEqual([]);
    await app.close();
    app = await fixture.launch();
    page = await app.firstWindow();
    await page
      .getByRole('button', { name: 'Preferências', exact: true })
      .click();
    await expect(page.getByLabel('Modo preferido')).toHaveValue('real');
    await expect(page.getByLabel('Idiomas preferidos')).toHaveValue(
      'pt-BR+en-US',
    );
    await expect(page.getByText('Inativa', { exact: true })).toBeVisible();
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
    // Simulate only the file selection; safeStorage and the product's storage/IPC are real.
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = () =>
        Promise.resolve({ canceled: false, filePaths: [path] });
    }, input);
    await page.getByRole('button', { name: 'Importar chave pelo Mac' }).click();
    await expect(page.getByText(/Chave OpenAI: armazenada/)).toBeVisible();
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
    await page
      .getByRole('button', { name: 'Remover chave armazenada' })
      .click();
    await expect(page.getByText(/Chave OpenAI: não configurada/)).toBeVisible();
    await expect(
      readFile(join(fixture.profile, 'openai-key.enc')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
