import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('synthetic native subprocess → real provider → IPC → live transcript and cleanup', async () => {
  test.skip(
    process.platform !== 'darwin',
    'Apple Local selection requires macOS',
  );
  const fixture = await createTestApp({
    denyNetwork: true,
    syntheticNative: true,
  });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.name));
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await page.getByRole('button', { name: 'Autorizar e iniciar' }).click();
    const preview = page.getByRole('region', { name: 'Transcrição ao vivo' });
    await expect(
      preview.getByText('Fala sintética do microfone.').first(),
    ).toBeVisible();
    await expect(
      preview.getByText('Fala sintética do sistema.').first(),
    ).toBeVisible();
    await expect(
      preview.getByText('Microfone · pt-BR · Ouvindo'),
    ).toBeVisible();
    await expect(preview.getByText('Sistema · pt-BR · Ouvindo')).toBeVisible();
    await page.getByRole('button', { name: 'Pausar' }).click();
    await expect(
      preview.getByText('Microfone · pt-BR · Pausada'),
    ).toBeVisible();
    const read = () =>
      page.evaluate(() =>
        window.meetingCopilot.session({ version: 3, action: 'read' }),
      );
    const paused = await read();
    await page.waitForTimeout(1200);
    expect(await read()).toEqual(paused);
    await page.getByRole('button', { name: 'Retomar' }).click();
    await expect(preview.getByText('Sistema · pt-BR · Ouvindo')).toBeVisible();
    await page.screenshot({
      path: 'test-results/local-transcript-synthetic.png',
    });
    await page.getByRole('button', { name: 'Parar' }).click();
    await expect(preview).toHaveCount(0);
    expect(await read()).toMatchObject({
      session: { phase: 'stopped' },
      local: null,
    });
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await page.getByRole('button', { name: 'Autorizar e iniciar' }).click();
    await expect(preview).toBeVisible();
    await page.reload();
    await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
    await expect(preview).toHaveCount(0);
    expect(await read()).toMatchObject({ local: null });
    expect(errors).toEqual([]);
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
