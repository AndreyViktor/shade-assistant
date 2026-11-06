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
    await page.getByText('Testar a demonstração').click();
    const start = page.getByRole('button', { name: 'Iniciar DEMO' });
    await expect(start).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Pausar' })).toHaveCount(0);
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pausar' }).click();
    await expect(page.getByText('Pausada', { exact: true })).toBeVisible();
    await expect(start).toBeDisabled();
    await page.getByRole('button', { name: 'Retomar' }).click();
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Parar' }).click();
    await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retomar' })).toHaveCount(0);
    await start.click();
    await expect(page.getByText('Em andamento', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
    await expect(start).toBeEnabled();
    expect(
      await page.evaluate(() =>
        window.meetingCopilot.session({
          version: 2,
          action: 'start',
          options: {
            mode: 'apple-local',
            consent: { capture: false, context: false, remoteAudio: false },
            locale: 'pt-BR',
            sources: ['mic', 'system'],
          },
        }),
      ),
    ).toEqual({ version: 2, ok: false, code: 'CAPTURE_CONSENT_REQUIRED' });
    expect(
      await page.evaluate(() =>
        window.meetingCopilot.session({
          version: 2,
          action: 'start',
          options: {
            mode: 'openai-stt',
            consent: { capture: true, context: false, remoteAudio: true },
          },
        }),
      ),
    ).toEqual({ version: 2, ok: false, code: 'REMOTE_STT_DEFERRED' });
    await page.locator('.privacy-details summary').click();
    await expect(page.getByText(/não é enviada à OpenAI/)).toBeVisible();
    await page.locator('.privacy-details summary').click();
    await page
      .getByRole('heading', { name: 'Meeting Copilot', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/session.png' });
    expect(outgoing).toEqual([]);
    const result = await page.evaluate(() =>
      window.meetingCopilot.session({ version: 2, action: 'read' }),
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
