import { access, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

export type NativeTranscriberEnvironment = {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  appPath: string;
  resourcesPath: string;
};

export class NativeTranscriberUnavailableError extends Error {
  constructor() {
    super('Apple native transcription helper is unavailable.');
    this.name = 'NativeTranscriberUnavailableError';
  }
}

/** Resolve only a main-owned development or app-resource path; never accept renderer paths. */
export async function resolveNativeTranscriberExecutable(
  environment: NativeTranscriberEnvironment,
): Promise<string> {
  if (environment.platform !== 'darwin')
    throw new NativeTranscriberUnavailableError();

  const root = environment.isPackaged
    ? environment.resourcesPath
    : environment.appPath;
  if (!isAbsolute(root)) throw new NativeTranscriberUnavailableError();
  const candidate = environment.isPackaged
    ? join(root, 'native', 'MeetingCopilotTranscriber')
    : join(
        root,
        'native',
        'macos',
        '.build',
        'release',
        'MeetingCopilotTranscriber',
      );

  try {
    const metadata = await lstat(candidate);
    if (!metadata.isFile() || (metadata.mode & 0o111) === 0)
      throw new NativeTranscriberUnavailableError();
    const [resolvedRoot, resolvedExecutable] = await Promise.all([
      realpath(root),
      realpath(candidate),
    ]);
    const pathFromRoot = relative(resolvedRoot, resolvedExecutable);
    if (
      pathFromRoot === '' ||
      pathFromRoot === '..' ||
      pathFromRoot.startsWith(`..${sep}`) ||
      isAbsolute(pathFromRoot)
    )
      throw new NativeTranscriberUnavailableError();
    await access(resolvedExecutable, constants.X_OK);
    return resolvedExecutable;
  } catch {
    throw new NativeTranscriberUnavailableError();
  }
}
