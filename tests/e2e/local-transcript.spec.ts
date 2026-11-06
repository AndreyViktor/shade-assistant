import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';
import { reconciledReplayIds } from '../integration/transcriptReplay';

test('reconciles synthetic revisions and echo through the provider, IPC and renderer', async () => {
  test.skip(
    process.platform !== 'darwin',
    'Apple Local selection requires macOS',
  );
  const fixture = await createTestApp({
    denyNetwork: true,
    syntheticNative: 'reconciliation',
  });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page
      .getByRole('button', { name: 'Iniciar transcrição local' })
      .click();
    await page.getByRole('button', { name: 'Autorizar e iniciar' }).click();
    const read = () =>
      page.evaluate(() =>
        window.meetingCopilot.session({ version: 3, action: 'read' }),
      );
    const ids = async () => {
      const snapshot = await read();
      return snapshot.ok
        ? snapshot.local?.segments.map((segment) => segment.segmentId)
        : [];
    };
    await expect.poll(ids).toEqual(reconciledReplayIds);
    const log = page.getByRole('log', { name: 'Falas recentes' });
    await expect(log.locator('.transcript-segment')).toHaveCount(7);
    await expect(log.locator('.transcript-segment').first()).toContainText(
      'Sistema · pt-BR · Final',
    );
    await expect(log.locator('.transcript-segment').first()).toContainText(
      '00:01.000–00:02.000',
    );
    await expect(log.getByText('Sim.', { exact: true })).toHaveCount(2);
    await expect(log.getByText('Hipótese atrasada')).toHaveCount(0);
    await expect(
      page.getByText(/A fonte de áudio não identifica a pessoa/),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/transcript-reconciliation-synthetic.png',
    });
    await page.getByRole('button', { name: 'Pausar' }).click();
    await expect.poll(ids).toEqual(reconciledReplayIds.slice(0, -1));
    await expect(log.getByText('Revisão temporária')).toHaveCount(0);
    await page.getByRole('button', { name: 'Retomar' }).click();
    await expect(page.getByText('Sistema · pt-BR · Ouvindo')).toBeVisible();
    expect(await ids()).toEqual(reconciledReplayIds.slice(0, -1));
    await page.getByRole('button', { name: 'Parar' }).click();
    expect(await read()).toMatchObject({ local: null });
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
