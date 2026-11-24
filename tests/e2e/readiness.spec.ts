import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createTestApp } from './testApp';

test('checks readiness through the UI without starting capture or using the network', async () => {
  test.skip(process.platform !== 'darwin', 'Readiness helper requires macOS');
  const fixture = await createTestApp({ syntheticNative: true });
  const helper = join(
    fixture.directory,
    'native/macos/.build/MeetingCopilotTranscriber.app/Contents/MacOS/MeetingCopilotTranscriber',
  );
  const calls = join(fixture.directory, 'readiness-calls');
  const report = {
    reportVersion: 1,
    scope: 'session-preflight-no-capture',
    owner: { capture: 'MeetingCopilotTranscriber', host: 'Meeting Copilot' },
    microphone: { state: 'not-requested', detail: 'exact' },
    systemAudio: { state: 'denied', detail: 'screen-preflight-ambiguous' },
    speechRecognition: { state: 'restricted', detail: 'exact' },
    helper: { state: 'allowed', detail: 'exact' },
    helperIdentity: {
      process: 'MeetingCopilotTranscriber',
      bundleIdentifier: 'local.meetingcopilot.transcriber',
      signingIdentifier: 'local.meetingcopilot.transcriber',
      signature: 'no-team',
    },
  };
  await writeFile(
    helper,
    `#!${process.execPath}\nif (process.argv.length !== 3 || process.argv[2] !== '--readiness') process.exit(2);\nrequire('node:fs').appendFileSync(${JSON.stringify(calls)}, 'check\\n');\nprocess.stdout.write(${JSON.stringify(JSON.stringify(report))});\n`,
    { mode: 0o700 },
  );
  const app = await fixture.launch();
  try {
    const page = await app.firstWindow();
    await page
      .getByRole('button', { name: 'Preferências', exact: true })
      .click();
    await page.getByRole('button', { name: 'Verificar prontidão' }).click();
    const readiness = page.getByRole('region', { name: 'Prontidão da sessão' });
    await expect(readiness).toContainText('Não solicitado');
    await expect(readiness).toContainText(
      'Não permitido ou ainda não solicitado',
    );
    await expect(readiness).toContainText('Restrito');
    await expect(readiness).toContainText('sem identificador de equipe');
    await readiness.getByRole('button', { name: 'Rechecar prontidão' }).click();
    await expect.poll(() => readFile(calls, 'utf8')).toBe('check\ncheck\n');
    expect(
      await page.evaluate(() =>
        window.meetingCopilot.session({ version: 11, action: 'read' }),
      ),
    ).toMatchObject({ session: { phase: 'idle' } });
    expect(
      await app.evaluate((): unknown =>
        Reflect.get(globalThis, 'demoNetworkAttempts'),
      ),
    ).toBe(0);
  } finally {
    await app.close();
    await fixture.cleanup();
  }
});
