import {
  nativeHelperFixture,
  reconciliationHelperFixture,
} from './nativeHelperFixture';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { _electron as electron } from '@playwright/test';

export async function createTestApp(
  options: {
    denyNetwork?: boolean;
    syntheticNative?: boolean | 'reconciliation';
  } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), 'meeting-copilot-smoke-'));
  const profile = join(directory, 'profile');
  const entry = join(directory, 'entry.cjs');
  let nativeBootstrap = '';
  if (options.syntheticNative) {
    const helper = join(
      directory,
      'native/macos/.build/MeetingCopilotTranscriber.app/Contents/MacOS/MeetingCopilotTranscriber',
    );
    await mkdir(dirname(helper), { recursive: true });
    const fixture =
      options.syntheticNative === 'reconciliation'
        ? reconciliationHelperFixture
        : nativeHelperFixture;
    await writeFile(helper, `#!${process.execPath}\n${fixture}`, {
      mode: 0o700,
    });
    nativeBootstrap = `app.getAppPath = () => ${JSON.stringify(directory)}; require('electron').systemPreferences.askForMediaAccess = async () => true;`;
  }

  // Test-only guards installed before product modules. Counts only, no URLs/data.
  const offlineBootstrap = options.denyNetwork
    ? `
globalThis.demoNetworkAttempts = 0;
const deny = () => { globalThis.demoNetworkAttempts += 1; throw new Error('Offline smoke: network disabled'); };
require('node:net').Socket.prototype.connect = deny;
require('node:dgram').Socket.prototype.send = deny;
globalThis.fetch = deny;
require('electron').net.fetch = deny;
require('electron').net.request = deny;
app.on('session-created', (session) => {
  session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => {
    globalThis.demoNetworkAttempts += 1;
    callback({ cancel: true });
  });
});
`
    : '';
  // Test-only bootstrap keeps preferences and ciphertext out of the user's profile.
  await writeFile(
    entry,
    `const { app } = require('electron');\n${offlineBootstrap}\n${nativeBootstrap}\napp.setPath('userData', ${JSON.stringify(profile)});\nrequire(${JSON.stringify(resolve('dist/main/index.js'))});\n`,
  );
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value !== undefined &&
      key !== 'OPENAI_API_KEY' &&
      key !== 'ELECTRON_RUN_AS_NODE'
    )
      env[key] = value;
  }
  env.ELECTRON_RENDERER_URL = '';
  return {
    directory,
    profile,
    launch: () => electron.launch({ args: [entry], env }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
