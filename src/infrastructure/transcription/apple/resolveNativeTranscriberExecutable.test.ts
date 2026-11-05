import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  NativeTranscriberUnavailableError,
  resolveNativeTranscriberExecutable,
} from './resolveNativeTranscriberExecutable';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'meeting-copilot-helper-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('resolveNativeTranscriberExecutable', () => {
  it('selects the fixed release binary in development and requires executable file', async () => {
    const root = await temporaryDirectory();
    const path = join(
      root,
      'native/macos/.build/release/MeetingCopilotTranscriber',
    );
    await mkdir(join(root, 'native/macos/.build/release'), { recursive: true });
    await writeFile(path, 'test executable');
    await chmod(path, 0o700);

    await expect(
      resolveNativeTranscriberExecutable({
        platform: 'darwin',
        isPackaged: false,
        appPath: root,
        resourcesPath: join(root, 'resources'),
      }),
    ).resolves.toBe(await realpath(path));
  });

  it('resolves the packaged helper from app resources without accepting another path', async () => {
    const resources = await temporaryDirectory();
    const path = join(resources, 'native/MeetingCopilotTranscriber');
    await mkdir(join(resources, 'native'), { recursive: true });
    await writeFile(path, 'test executable');
    await chmod(path, 0o700);

    await expect(
      resolveNativeTranscriberExecutable({
        platform: 'darwin',
        isPackaged: true,
        appPath: '/untrusted/renderer/path',
        resourcesPath: resources,
      }),
    ).resolves.toBe(await realpath(path));
  });

  it('rejects other platforms, missing files and symlinked binaries safely', async () => {
    const root = await temporaryDirectory();
    const release = join(root, 'native/macos/.build/release');
    const path = join(release, 'MeetingCopilotTranscriber');
    await mkdir(release, { recursive: true });
    const target = join(root, 'outside-helper');
    await writeFile(target, 'test executable');
    await chmod(target, 0o700);
    await symlink(target, path);

    const environment = {
      platform: 'darwin' as const,
      isPackaged: false,
      appPath: root,
      resourcesPath: root,
    };
    await expect(
      resolveNativeTranscriberExecutable({ ...environment, platform: 'win32' }),
    ).rejects.toBeInstanceOf(NativeTranscriberUnavailableError);
    await expect(
      resolveNativeTranscriberExecutable(environment),
    ).rejects.toBeInstanceOf(NativeTranscriberUnavailableError);
    await rm(path);
    await expect(
      resolveNativeTranscriberExecutable(environment),
    ).rejects.toBeInstanceOf(NativeTranscriberUnavailableError);
  });
});
