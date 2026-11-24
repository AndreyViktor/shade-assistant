// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createReadinessService } from './createReadinessService';

describe('readiness service', () => {
  it('probes only on macOS and opens only fixed privacy destinations', async () => {
    const probe = vi.fn().mockResolvedValue({ helper: 'synthetic' });
    const resolveExecutable = vi.fn().mockResolvedValue('/fixed/helper');
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const service = createReadinessService({
      platform: 'darwin',
      resolveExecutable,
      openExternal,
      probe,
    });
    expect(await service.check()).toEqual({ helper: 'synthetic' });
    expect(probe).toHaveBeenCalledExactlyOnceWith(resolveExecutable);
    await service.openSettings('microphone');
    await service.openSettings('screen-recording');
    await service.openSettings('speech-recognition');
    expect(openExternal.mock.calls.flat()).toEqual([
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
      'x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition',
    ]);
  });

  it('reports unavailable and never probes or opens settings off macOS', async () => {
    const probe = vi.fn();
    const openExternal = vi.fn();
    const service = createReadinessService({
      platform: 'linux',
      resolveExecutable: vi.fn(),
      openExternal,
      probe,
    });
    expect(await service.check()).toMatchObject({
      microphone: { state: 'unavailable', detail: 'helper-missing' },
    });
    await expect(service.openSettings('microphone')).rejects.toThrow(
      'UNAVAILABLE',
    );
    expect(probe).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });
});
