// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { ContextManager } from '../../src/core/meeting/ContextManager';
import { LocalTranscript } from '../../src/core/transcription/LocalTranscript';
import { AppleNativeTranscriptionProvider } from '../../src/infrastructure/transcription/apple/AppleNativeTranscriptionProvider';
import type {
  AudioSource,
  TranscriptionEvent,
} from '../../src/contracts/native/protocol';

const enabled = process.env['MEETING_COPILOT_CAPTURE_TEST'] === '1';
const helper = process.env['MEETING_COPILOT_HELPER'];
const sources: AudioSource[] = ['mic', 'system'];
const run = promisify(execFile);

it.skipIf(!enabled)(
  'reconciles synthetic system playback recaptured by an authorized microphone',
  async () => {
    if (!helper) throw new Error('Missing native helper executable');
    const sessionId = `capture-${randomUUID().replaceAll('-', '')}`;
    const config = { sessionId, sources, locale: 'pt-BR' as const };
    const counts = new Map<AudioSource, number>([
      ['mic', 0],
      ['system', 0],
    ]);
    const finalMetadata: Array<{
      source: AudioSource;
      startMs: number;
      endMs: number;
      wordCount: number;
    }> = [];
    const local = new LocalTranscript();
    const context = new ContextManager();
    local.start(config);
    context.start(config);
    const provider = new AppleNativeTranscriptionProvider({
      resolveExecutable: () => Promise.resolve(helper),
    });
    try {
      await provider.start(
        config,
        (event: TranscriptionEvent) => {
          local.receive(event, true);
          context.receive(event);
          if (event.type === 'final') {
            counts.set(event.source, (counts.get(event.source) ?? 0) + 1);
            finalMetadata.push({
              source: event.source,
              startMs: event.startMs,
              endMs: event.endMs,
              wordCount: event.text.trim().split(/\s+/u).filter(Boolean).length,
            });
          }
        },
        new AbortController().signal,
      );
      process.stdout.write('\nCAPTURE_ACTIVE_PLAYING_SYNTHETIC_AUDIO\n');
      await run('/usr/bin/say', [
        '-v',
        'Luciana',
        'Precisamos revisar o plano de entrega amanhã antes da reunião da equipe.',
      ]);
      await delay(15_000);
      for (const source of sources)
        expect(
          counts.get(source),
          `${source} final transcription count`,
        ).toBeGreaterThan(0);
      const rawFinals = [...counts.values()].reduce(
        (total, count) => total + count,
        0,
      );
      const localFinals =
        local.snapshot()?.segments.filter((segment) => segment.type === 'final')
          .length ?? 0;
      const contextFinals =
        context.snapshot()?.recent.filter((segment) => segment.type === 'final')
          .length ?? 0;
      process.stdout.write(
        `${JSON.stringify({
          rawFinals,
          localFinals,
          contextFinals,
          sourceFinals: Object.fromEntries(counts),
          finalMetadata,
        })}\n`,
      );
      expect(localFinals, 'reconciled local final count').toBeLessThan(
        rawFinals,
      );
      expect(contextFinals, 'reconciled context final count').toBeLessThan(
        rawFinals,
      );
    } finally {
      await provider.stop();
    }
  },
  45_000,
);
