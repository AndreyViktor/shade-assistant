import { expect, it } from 'vitest';
import { NativeJsonlDecoder } from '../../src/contracts/native/NativeJsonlDecoder';
import { ContextManager } from '../../src/core/meeting/ContextManager';
import { transcriptReplay } from './transcriptReplay';
import type {
  TranscriptionConfig,
  TranscriptionEvent,
} from '../../src/contracts/native/protocol';

it.each(['pt-BR', 'en-US'] as const)(
  'feeds fragmented native JSONL into bounded context in %s without capture or API',
  (locale) => {
    const config: TranscriptionConfig = {
      sessionId: 'replay',
      sources: ['mic', 'system'],
      locale,
    };
    const decoder = new NativeJsonlDecoder(config);
    const context = new ContextManager();
    context.start(config);
    const feed = (event: TranscriptionEvent) => {
      const bytes = new TextEncoder().encode(`${JSON.stringify(event)}\n`);
      // Splits metadata and multibyte Unicode; exercises the actual T012 framing/validation.
      for (let offset = 0; offset < bytes.length; offset += 7) {
        for (const decoded of decoder.push(bytes.subarray(offset, offset + 7)))
          context.receive(decoded);
      }
    };
    for (const source of config.sources) {
      feed({
        version: 1,
        sessionId: config.sessionId,
        locale,
        source,
        seq: 1,
        timestampMs: 0,
        type: 'ready',
        supportsPartial: true,
      });
      feed({
        version: 1,
        sessionId: config.sessionId,
        locale,
        source,
        seq: 2,
        timestampMs: 0,
        type: 'status',
        state: 'listening',
      });
    }
    for (const event of transcriptReplay(locale))
      feed({ ...event, seq: event.seq + 2 });
    expect(context.snapshot()?.recent.map((event) => event.segmentId)).toEqual([
      'corrected',
      'early',
      'overlap',
      'later',
      'short',
      'short',
      'repeat',
      'pause-draft',
    ]);
    expect(context.snapshot()?.summary).toEqual([]);
    context.advanceTo(300_000);
    expect(context.snapshot()?.recent).toEqual([]);
    expect(context.snapshot()?.summary.map((entry) => entry.segmentId)).toEqual(
      ['corrected', 'early', 'overlap', 'later', 'short', 'short', 'repeat'],
    );
    expect(context.snapshot()?.estimatedTokens).toBeLessThanOrEqual(12_000);
    for (const source of config.sources)
      feed({
        version: 1,
        sessionId: config.sessionId,
        locale,
        source,
        seq: source === 'mic' ? 10 : 6,
        timestampMs: 300_000,
        type: 'stopped',
        reason: 'completed',
      });
    decoder.finish();
    expect(context.snapshot()).toBeNull();
  },
);
