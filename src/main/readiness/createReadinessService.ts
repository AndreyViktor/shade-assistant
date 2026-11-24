import type {
  PermissionSettingsTarget,
  ReadinessSnapshot,
} from '../../contracts/ipc/readiness';
import { unavailableReadiness } from '../../contracts/ipc/readiness';
import { probeNativeReadiness } from './probeNativeReadiness';

const SETTINGS_URLS: Record<PermissionSettingsTarget, string> = {
  microphone:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  'screen-recording':
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  'speech-recognition':
    'x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition',
};

export type ReadinessService = {
  check: () => Promise<ReadinessSnapshot>;
  openSettings: (target: PermissionSettingsTarget) => Promise<void>;
};

export function createReadinessService(options: {
  platform: NodeJS.Platform;
  resolveExecutable: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  probe?: typeof probeNativeReadiness;
}): ReadinessService {
  return {
    check: () =>
      options.platform === 'darwin'
        ? (options.probe ?? probeNativeReadiness)(options.resolveExecutable)
        : Promise.resolve(unavailableReadiness('helper-missing')),
    async openSettings(target) {
      if (options.platform !== 'darwin') throw new Error('UNAVAILABLE');
      await options.openExternal(SETTINGS_URLS[target]);
    },
  };
}
