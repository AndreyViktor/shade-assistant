// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function text(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

describe('security baseline configuration', () => {
  it('pins the audited Electron release with registry integrity', async () => {
    const packageJson: unknown = JSON.parse(await text('package.json'));
    const packageLock: unknown = JSON.parse(await text('package-lock.json'));

    expect(packageJson).toMatchObject({
      devDependencies: { electron: '45.4.1' },
    });
    expect(packageLock).toMatchObject({
      lockfileVersion: 3,
      packages: {
        '': { devDependencies: { electron: '45.4.1' } },
        'node_modules/electron': {
          version: '45.4.1',
          resolved: 'https://registry.npmjs.org/electron/-/electron-45.4.1.tgz',
          integrity:
            'sha512-DjsJ/eQhovkjf1vYFFyh5GB8NMx+L5bdYaonvGOlWselg3DQ0fwIF0N/+2hrPsoS4whmmNswh21ym/8dgt1y5Q==',
        },
      },
    });
  });

  it('keeps the production renderer CSP local and network-denying', async () => {
    const html = await text('src/renderer/index.html');
    expect(html).toContain(
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'",
    );
    expect(html).not.toMatch(/https?:|wss?:|unsafe-eval|data:/);
  });

  it('declares only the native capture purposes on the stable helper bundle', async () => {
    const info = await text('native/macos/TranscriberApp/Info.plist');
    expect(info).toContain('<string>local.meetingcopilot.transcriber</string>');
    for (const key of [
      'NSMicrophoneUsageDescription',
      'NSAudioCaptureUsageDescription',
      'NSScreenCaptureUsageDescription',
      'NSSpeechRecognitionUsageDescription',
    ]) {
      expect(info).toContain(`<key>${key}</key>`);
    }
    expect(info).not.toContain('NSCameraUsageDescription');
    expect(info).toContain('<key>LSUIElement</key>\n  <true/>');
  });

  it('keeps the Swift helper dependency-free and signs it without broad entitlements', async () => {
    const manifest = await text('native/macos/Package.swift');
    const buildScript = await text('scripts/build-native-helper-app.sh');
    expect(manifest).not.toContain('.package(');
    expect(buildScript).not.toContain('codesign --force --deep');
    expect(buildScript).toContain('--options runtime --timestamp=none');
    expect(buildScript).toContain('codesign --verify --strict');
    expect(buildScript).toContain('entitlements=none');
  });
});
