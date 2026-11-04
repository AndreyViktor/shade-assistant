import { createTestApp } from './testApp';
import { expect, test } from '@playwright/test';

test('opens the real Electron build with an isolated offline renderer', async () => {
  const fixture = await createTestApp();
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole('heading', { name: 'Meeting Copilot', level: 1 }),
    ).toBeVisible();
    await expect(page.getByLabel('Modo demonstração')).toHaveText('DEMO');
    await expect(page.getByText('Inativa')).toBeVisible();
    expect(page.url()).toMatch(/^file:\/\//);

    const isolation = await page.evaluate(() => ({
      require: 'require' in window,
      process: 'process' in window,
      bridge: 'electron' in window || 'ipcRenderer' in window,
      methods: Object.keys(window.meetingCopilot),
      frozen: Object.isFrozen(window.meetingCopilot),
    }));
    expect(isolation).toEqual({
      require: false,
      process: false,
      bridge: false,
      methods: [
        'session',
        'getStatus',
        'getSettings',
        'savePreferences',
        'importSecret',
        'removeSecret',
      ],
      frozen: true,
    });

    expect(
      await page.evaluate(() => window.meetingCopilot.getStatus()),
    ).toEqual({
      version: 1,
      ok: true,
      status: {
        mode: 'demo',
        capture: 'inactive',
        ai: 'disabled',
        dataSent: 'none',
      },
    });
    expect(
      await page.evaluate((): unknown =>
        Reflect.apply(window.meetingCopilot.getStatus, null, [
          'arbitrary:channel',
        ]),
      ),
    ).toEqual({
      version: 1,
      ok: false,
      code: 'INVALID_REQUEST',
    });

    await expect(
      page.locator('meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveAttribute('content', /connect-src 'none'/);

    const outgoing: string[] = [];
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) outgoing.push(request.url());
    });
    await page.reload();
    await expect(page.getByText('Nenhum', { exact: true })).toBeVisible();
    expect(outgoing).toEqual([]);
    await page.screenshot({ path: 'test-results/startup.png' });

    await page.evaluate(() => {
      window.open('https://example.com');
    });
    expect(app.windows()).toHaveLength(1);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
