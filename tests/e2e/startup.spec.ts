import { _electron as electron, expect, test } from '@playwright/test';

test('opens the real Electron build with an isolated offline renderer', async () => {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.ELECTRON_RENDERER_URL = '';
  // Hosts built on Electron may inherit this flag; the test must launch the desktop app.
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ['.'],
    env,
  });
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
    }));
    expect(isolation).toEqual({
      require: false,
      process: false,
      bridge: false,
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
  }
});
