import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('manual demo session uses real IPC, stops on reload and never enables real services', async () => {
  const fixture = await createTestApp();
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    const outgoing: string[] = [];
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) outgoing.push(request.url());
    });
    const start = page.getByRole('button', { name: 'Iniciar DEMO' });
    await expect(start).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeDisabled();
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
    await expect(page.getByText('Inativa', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pausar' }).click();
    await expect(page.getByText('Pausada', { exact: true })).toBeVisible();
    await expect(start).toBeDisabled();
    await page.getByRole('button', { name: 'Retomar' }).click();
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Parar' }).click();
    await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retomar' })).toBeDisabled();
    await start.click();
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
    await expect(start).toBeEnabled();
    for (const mode of ['apple-local', 'openai-stt'] as const) {
      expect(
        await page.evaluate(
          (mode) =>
            window.meetingCopilot.session({
              version: 1,
              action: 'start',
              options: {
                mode,
                consent: { capture: true, context: true, remoteAudio: true },
              },
            }),
          mode,
        ),
      ).toEqual({ version: 1, ok: false, code: 'UNAVAILABLE' });
    }
    await page.locator('summary').click();
    await expect(page.getByText(/Texto de contexto só poderá/)).toBeVisible();
    await expect(page.getByText(/custos de API/)).toBeVisible();
    await page.locator('summary').click();
    await page
      .getByRole('heading', { name: 'Meeting Copilot', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/session.png' });
    expect(outgoing).toEqual([]);
    const result = await page.evaluate(() =>
      window.meetingCopilot.session({ version: 1, action: 'read' }),
    );
    expect(result).toMatchObject({
      ok: true,
      session: {
        phase: 'stopped',
        consent: { capture: false, context: false, remoteAudio: false },
      },
    });
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
