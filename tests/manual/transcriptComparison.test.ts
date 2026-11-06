// @vitest-environment node
import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { TranscriptReconciler } from '../../src/core/transcription/TranscriptReconciler';
import { MAX_VISIBLE_SEGMENTS } from '../../src/contracts/meeting/localTranscript';
import type { SpeechSegment } from '../../src/contracts/meeting/localTranscript';
import { transcriptReplay } from '../integration/transcriptReplay';

// Frozen display policy from 0d360cc LocalTranscript, without session/channel checks.
// Comparison measures receive + snapshot CPU only, not STT or renderer latency.
class T017DisplayPolicy {
  private segments: SpeechSegment[] = [];
  receive(event: SpeechSegment): void {
    const index = this.segments.findIndex(
      (segment) =>
        segment.source === event.source &&
        segment.segmentId === event.segmentId,
    );
    if (index >= 0) {
      if (this.segments[index]?.type === 'final') return;
      this.segments[index] = { ...event };
    } else this.segments.push({ ...event });
    this.segments = this.segments.slice(-MAX_VISIBLE_SEGMENTS);
  }
  snapshot(): SpeechSegment[] {
    return this.segments.map((segment) => ({ ...segment }));
  }
}

function metrics(segments: SpeechSegment[]) {
  let inversions = 0;
  let overlappingFinalPairs = 0;
  for (const [index, a] of segments.entries()) {
    for (const b of segments.slice(index + 1)) {
      if (a.startMs > b.startMs) inversions++;
      if (
        a.type === 'final' &&
        b.type === 'final' &&
        Math.min(a.endMs, b.endMs) > Math.max(a.startMs, b.startMs)
      )
        overlappingFinalPairs++;
    }
  }
  return {
    visible: segments.length,
    partials: segments.filter((segment) => segment.type === 'partial').length,
    inversions,
    overlappingFinalPairs,
  };
}

const enabled = process.env['MEETING_COPILOT_COMPARE_TRANSCRIPT'] === '1';
it.skipIf(!enabled)(
  'compares synthetic T017/T018 display policies without capturing audio',
  () => {
    for (const locale of ['pt-BR', 'en-US'] as const) {
      for (const maxText of [false, true]) {
        const replay = transcriptReplay(locale).map((event) =>
          maxText ? { ...event, text: event.text.padEnd(4096, ' x') } : event,
        );
        const samples: Record<string, number[]> = { T017: [], T018: [] };
        for (let iteration = 0; iteration < 1100; iteration++) {
          const policies = [
            ['T017', new T017DisplayPolicy()],
            ['T018', new TranscriptReconciler()],
          ] as const;
          // Alternate execution order; first 100 sessions warm up and are excluded.
          for (const [name, policy] of iteration % 2
            ? [...policies].reverse()
            : policies) {
            for (const event of replay) {
              const start = performance.now();
              policy.receive(event);
              policy.snapshot();
              const elapsed = performance.now() - start;
              if (iteration >= 100) samples[name]?.push(elapsed);
            }
          }
        }
        const baseline = new T017DisplayPolicy();
        const current = new TranscriptReconciler();
        for (const event of transcriptReplay(locale)) {
          baseline.receive(event);
          current.receive(event);
        }
        expect(metrics(baseline.snapshot())).toMatchObject({
          visible: 10,
          partials: 3,
          inversions: 8,
          overlappingFinalPairs: 4,
        });
        expect(metrics(current.snapshot())).toEqual({
          visible: 7,
          partials: 1,
          inversions: 0,
          overlappingFinalPairs: 2,
        });
        const timing = Object.fromEntries(
          Object.entries(samples).map(([name, values]) => {
            values.sort((a, b) => a - b);
            expect(values).toHaveLength(10_000);
            return [
              name,
              {
                observations: values.length,
                p50Ms: values[Math.ceil(values.length * 0.5) - 1],
                p95Ms: values[Math.ceil(values.length * 0.95) - 1],
              },
            ];
          }),
        );
        console.info(
          JSON.stringify({
            synthetic: true,
            locale,
            maxText,
            timing,
            normalReplay: {
              T017: metrics(baseline.snapshot()),
              T018: metrics(current.snapshot()),
            },
          }),
        );
      }
    }
  },
  30_000,
);
