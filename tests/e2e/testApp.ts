import {
  nativeHelperFixture,
  suggestionHelperFixture,
  reconciliationHelperFixture,
  layoutHelperFixture,
} from './nativeHelperFixture';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { _electron as electron } from '@playwright/test';

export async function createTestApp(
  options: {
    denyNetwork?: boolean;
    denyCapture?: boolean;
    syntheticNative?:
      | boolean
      | 'reconciliation'
      | 'suggestions'
      | 'layout'
      | 'silent'
      | 'failure';
    syntheticSuggestions?: boolean;
    syntheticSuggestionOutcome?: 'empty' | 'authentication';
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
      options.syntheticNative === 'failure'
        ? `const replay = [{ source: 'mic', type: 'error', code: 'capture-failed' }];\n${nativeHelperFixture}`
        : options.syntheticNative === 'silent'
          ? `const replay = [];\n${nativeHelperFixture}`
          : options.syntheticNative === 'layout'
            ? layoutHelperFixture
            : options.syntheticNative === 'suggestions'
              ? suggestionHelperFixture
              : options.syntheticNative === 'reconciliation'
                ? reconciliationHelperFixture
                : nativeHelperFixture;
    await writeFile(helper, `#!${process.execPath}\n${fixture}`, {
      mode: 0o700,
    });
    nativeBootstrap = `require('electron').systemPreferences.askForMediaAccess = async () => true;`;
  }

  const captureBootstrap = options.denyCapture
    ? `
globalThis.captureAttempts = 0;
const denyCapture = () => { globalThis.captureAttempts += 1; throw new Error('Offline smoke: capture disabled'); };
require('node:child_process').spawn = denyCapture;
require('node:child_process').execFile = denyCapture;
require('electron').systemPreferences.askForMediaAccess = denyCapture;
require('electron').desktopCapturer.getSources = denyCapture;
`
    : '';

  // Test-only guards installed before product modules. Counts only, no URLs/data.
  const offlineBootstrap =
    options.denyNetwork !== false
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
  const successCards =
    options.syntheticNative === 'layout'
      ? Array.from({ length: 8 }, (_, index) => ({
          category: index % 2 === 0 ? 'question' : 'action',
          title: `Sugestão sintética ${String(index + 1).padStart(2, '0')}`,
          body: `Card fictício ${index + 1}: confirme o responsável, o prazo e o próximo passo acordado para este item da reunião. `.repeat(
            2,
          ),
          groundedIn: index % 2 === 0 ? 'inference' : 'meeting',
        }))
      : [
          {
            category: 'question',
            title: 'Prazo sintético Aurora',
            body: 'Confirme a data do projeto fictício.',
            groundedIn: 'inference',
          },
        ];
  const successResultUpdates = [
    {
      operation: 'upsert',
      key: 'prazo-aurora',
      kind: 'question',
      text: 'Qual é o prazo do projeto Aurora?',
      groundedIn: 'meeting',
      evidence: [
        options.syntheticNative === 'layout'
          ? { source: 'system', segmentId: 'layout-7' }
          : { source: 'mic', segmentId: 'synthetic-question' },
      ],
    },
  ];
  // Only this test bootstrap replaces the transport; production has no mock flag.
  const suggestionBootstrap = options.syntheticSuggestions
    ? `
    const blockedFetch = globalThis.fetch;
    globalThis.syntheticSuggestionRequests = [];
    globalThis.fetch = async (url, options) => {
      if (url !== 'https://api.openai.com/v1/responses') return blockedFetch(url, options);
      const body = JSON.parse(options.body);
      if (options.headers.Authorization !== 'Bearer t024-synthetic-not-a-key' || !['gpt-5.4-mini', 'gpt-5.4'].includes(body.model)) throw new Error('Unexpected synthetic configuration');
      globalThis.syntheticSuggestionRequests.push(body);
      const outcome = ${JSON.stringify(options.syntheticSuggestionOutcome ?? 'success')};
      if (outcome === 'authentication') return new Response(JSON.stringify({error:'private-error-sentinel'}), {status:401});
      if (outcome === 'empty') return new Response(JSON.stringify({status:'completed', output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify({suggestions:[],resultUpdates:[]})}]}]}), {status:200});
      const suggestions = ${JSON.stringify(successCards)};
      const resultUpdates = ${JSON.stringify(successResultUpdates)};
      return new Response(JSON.stringify({status:'completed', output:[{
        type:'message', role:'assistant', status:'completed', content:[{
          type:'output_text', text:JSON.stringify({suggestions,resultUpdates})
        }]
      }]}), {status:200});
    };
  `
    : '';
  // Test-only bootstrap keeps preferences and ciphertext out of the user's profile.
  await writeFile(
    entry,
    `const { app } = require('electron');\napp.getAppPath = () => ${JSON.stringify(directory)};\n${offlineBootstrap}\n${captureBootstrap}\n${suggestionBootstrap}\n${nativeBootstrap}\napp.setPath('userData', ${JSON.stringify(profile)});\nrequire(${JSON.stringify(resolve('dist/main/index.js'))});\n`,
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
  if (options.syntheticSuggestions)
    env.OPENAI_API_KEY = 't024-synthetic-not-a-key';
  return {
    directory,
    profile,
    launch: () => electron.launch({ args: [entry], env }),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
