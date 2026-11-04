import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('repeats start → speech → card → pause → stop without late events or residual state', async () => {
  test.setTimeout(45000);
  const fixture = await createTestApp({ denyNetwork: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.name));
    const start = page.getByRole('button', { name: 'Iniciar DEMO' });
    const preview = page.getByRole('region', { name: 'Roteiro DEMO' });
    const cards = page.getByRole('region', { name: 'Sugestões DEMO' });
    const read = () =>
      page.evaluate(() =>
        window.meetingCopilot.session({ version: 2, action: 'read' }),
      );
    await expect(start).toBeEnabled();
    expect(
      await page.evaluate(() => window.meetingCopilot.getSettings()),
    ).toMatchObject({ ok: true, settings: { credential: 'missing' } });
    expect(await app.evaluate(() => 'OPENAI_API_KEY' in process.env)).toBe(
      false,
    );

    let previousCardId: string | undefined;
    for (let run = 0; run < 2; run += 1) {
      await start.click();
      await expect(
        page.getByText('Em andamento', { exact: true }),
      ).toBeVisible();
      await expect(page.getByText('Inativa', { exact: true })).toBeVisible();
      expect(await read()).toMatchObject({
        demo: { transcript: null, suggestions: [], completed: false },
      });
      await expect(
        preview.getByText('Vamos revisar a migração do módulo de relatórios.'),
      ).toBeVisible();
      await expect(cards.getByRole('article')).toHaveCount(0);
      expect(await read()).toMatchObject({
        demo: { transcript: { sequence: 1, source: 'mic', locale: 'pt-BR' } },
      });
      await expect(
        preview.getByText('Que riscos precisamos avaliar antes da migração?'),
      ).toBeVisible();
      await expect(
        cards.getByRole('article', { name: 'Esclareça as dependências' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Pausar' }).click();
      await expect(page.getByText('Pausada', { exact: true })).toBeVisible();
      const paused = await read();
      expect(paused).toMatchObject({
        ok: true,
        session: {
          phase: 'paused',
          mode: 'demo',
          consent: { capture: false, context: false, remoteAudio: false },
        },
        demo: {
          completed: false,
          transcript: { sequence: 2, source: 'system', locale: 'pt-BR' },
          suggestions: [
            { category: 'question', title: 'Esclareça as dependências' },
          ],
        },
      });
      if (!paused.ok) throw new Error('Expected a readable paused session');
      const card = paused.demo.suggestions[0];
      expect(card).toBeDefined();
      expect(card?.id).not.toBe(previousCardId);
      previousCardId = card?.id;
      // Cross the pending turn's full delay using the real main-process clock.
      await page.waitForTimeout(3200);
      expect(await read()).toEqual(paused);
      await expect(cards.getByRole('article')).toHaveCount(1);
      await page.getByRole('button', { name: 'Parar' }).click();
      await expect(page.getByText('Encerrada', { exact: true })).toBeVisible();
      await expect(preview).toHaveCount(0);
      await expect(start).toBeEnabled();
      await expect(
        page.getByRole('button', { name: 'Retomar' }),
      ).toBeDisabled();
      const stopped = await read();
      expect(stopped).toMatchObject({
        ok: true,
        session: {
          phase: 'stopped',
          mode: 'demo',
          consent: { capture: false, context: false, remoteAudio: false },
        },
        demo: { transcript: null, suggestions: [], completed: false },
      });
      await page.waitForTimeout(3200);
      expect(await read()).toEqual(stopped);
      await expect(preview).toHaveCount(0);
    }
    expect(pageErrors).toEqual([]);
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
