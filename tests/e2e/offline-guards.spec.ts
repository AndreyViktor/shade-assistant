import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('offline guards reject and count deliberate transport probes before any connection', async () => {
  const fixture = await createTestApp({ denyNetwork: true });
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page.getByText('Testar a demonstração').click();
    await expect(
      page.getByRole('button', { name: 'Iniciar DEMO' }),
    ).toBeEnabled();
    const result = await app.evaluate(async ({ net }) => {
      const state = globalThis as typeof globalThis & {
        demoNetworkAttempts: number;
      };
      const before = state.demoNetworkAttempts;
      const udp = process.getBuiltinModule('node:dgram').createSocket('udp4');
      // Loopback only as a second safeguard; each probe must fail synchronously
      // at the installed guard, before DNS, a socket connection or an HTTP request.
      const probes = [
        () => process.getBuiltinModule('node:net').connect(9, '127.0.0.1'),
        () => process.getBuiltinModule('node:http').get('http://127.0.0.1:9/'),
        () =>
          process.getBuiltinModule('node:https').get('https://127.0.0.1:9/'),
        () => udp.send('synthetic', 9, '127.0.0.1'),
        () => globalThis.fetch('http://127.0.0.1:9/'),
        () => net.fetch('http://127.0.0.1:9/'),
        () => net.request('http://127.0.0.1:9/'),
      ];
      const blocked: boolean[] = [];
      try {
        for (const probe of probes) {
          try {
            await Promise.resolve(probe());
            blocked.push(false);
          } catch (error) {
            blocked.push(
              error instanceof Error &&
                error.message === 'Offline smoke: network disabled',
            );
          }
        }
      } finally {
        udp.close();
      }
      return { before, attempts: state.demoNetworkAttempts, blocked };
    });
    expect(result).toEqual({
      before: 0,
      attempts: 7,
      blocked: Array<boolean>(7).fill(true),
    });
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
