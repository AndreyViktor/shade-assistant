// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { AppleNativeTranscriptionProvider } from '../../src/infrastructure/transcription/apple/AppleNativeTranscriptionProvider';
import type {
  AudioSource,
  TranscriptionEvent,
} from '../../src/contracts/native/protocol';

const enabled = process.env['MEETING_COPILOT_CAPTURE_TEST'] === '1';
const helper = process.env['MEETING_COPILOT_HELPER'];
const sources: AudioSource[] = ['mic', 'system'];

it.skipIf(!enabled)(
  'captures synthetic speech from both authorized sources without logging transcript text',
  async () => {
    if (!helper) throw new Error('Missing native helper executable');
    const counts = new Map<AudioSource, number>([
      ['mic', 0],
      ['system', 0],
    ]);
    const listening = new Set<AudioSource>();
    const provider = new AppleNativeTranscriptionProvider({
      resolveExecutable: () => Promise.resolve(helper),
    });
    try {
      await provider.start(
        {
          sessionId: `capture-${randomUUID().replaceAll('-', '')}`,
          sources,
          locale: 'pt-BR',
        },
        (event: TranscriptionEvent) => {
          if (event.type === 'status' && event.state === 'listening') {
            listening.add(event.source);
            if (listening.size === sources.length)
              process.stdout.write(
                '\nCAPTURE_ACTIVE_SPEAK_SYNTHETIC_PHRASES_NOW\n',
              );
          }
          if (event.type === 'final')
            counts.set(event.source, (counts.get(event.source) ?? 0) + 1);
        },
        new AbortController().signal,
      );
      await delay(45_000);
      for (const source of sources)
        expect(
          counts.get(source),
          `${source} final transcription count`,
        ).toBeGreaterThan(0);
    } finally {
      await provider.stop();
    }
  },
  60_000,
);
