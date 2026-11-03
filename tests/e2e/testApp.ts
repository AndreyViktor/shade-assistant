import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from '@playwright/test';

export async function createTestApp() {
  const directory = await mkdtemp(join(tmpdir(), 'meeting-copilot-smoke-'));
  const profile = join(directory, 'profile');
  const entry = join(directory, 'entry.cjs');
  // Test-only bootstrap keeps preferences and ciphertext out of the user's profile.
  await writeFile(
    entry,
    `const { app } = require('electron');\napp.setPath('userData', ${JSON.stringify(profile)});\nrequire(${JSON.stringify(resolve('dist/main/index.js'))});\n`,
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
