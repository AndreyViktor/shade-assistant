import { app } from 'electron';
import { AppleNativeTranscriptionProvider } from '../../infrastructure/transcription/apple/AppleNativeTranscriptionProvider';
import { resolveNativeTranscriberExecutable } from '../../infrastructure/transcription/apple/resolveNativeTranscriberExecutable';

/** Main-process composition root; the provider starts only after a future consented session selects it. */
export async function createAppleNativeTranscriptionProvider(): Promise<AppleNativeTranscriptionProvider> {
  const executable = await resolveNativeTranscriberExecutable({
    platform: process.platform,
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
  });
  return new AppleNativeTranscriptionProvider({
    resolveExecutable: () => Promise.resolve(executable),
  });
}
