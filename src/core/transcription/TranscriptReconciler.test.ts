import { describe, expect, it } from 'vitest';
import {
  TranscriptReconciler,
  MAX_RETAINED_SEGMENTS,
} from './TranscriptReconciler';
import { MAX_VISIBLE_SEGMENTS } from '../../contracts/meeting/localTranscript';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';

const speech = (changes: Partial<SpeechSegment> = {}): SpeechSegment => ({
  version: 1,
  sessionId: 'test',
  source: 'mic',
  locale: 'pt-BR',
  seq: 1,
  timestampMs: 10_000,
  type: 'final',
  segmentId: 'one',
  startMs: 1000,
  endMs: 2000,
  text: 'Precisamos revisar o plano de entrega.',
  ...changes,
});
const reconcile = (...events: SpeechSegment[]) => {
  const reconciler = new TranscriptReconciler();
  for (const event of events) reconciler.receive(event);
  return reconciler.snapshot();
};

describe('temporal transcript reconciliation', () => {
  it('orders by speech time instead of arrival, emission timestamp or per-source sequence', () => {
    const later = speech({
      source: 'system',
      startMs: 3000,
      endMs: 4000,
      timestampMs: 5000,
    });
    const early = speech({ seq: 20, timestampMs: 6000 });
    expect(reconcile(later, early)).toEqual([early, later]);
  });

  it('uses deterministic end/source/sequence tie breaks and preserves zero-length ranges', () => {
    const mic = speech({ text: 'Sim.', startMs: 1000, endMs: 1000 });
    const system = { ...mic, source: 'system' as const };
    expect(reconcile(system, mic)).toEqual(reconcile(mic, system));
    expect(reconcile(system, mic)).toEqual([mic, system]);
  });

  it('replaces partials by ID even when the time range changes substantially', () => {
    const final = speech({ seq: 3, startMs: 1500, endMs: 3000 });
    expect(
      reconcile(
        speech({ type: 'partial' }),
        speech({ type: 'partial', seq: 2, text: 'Revisão' }),
        final,
      ),
    ).toEqual([final]);
  });

  it('reconciles a revised start/ID and never regresses a final to a partial', () => {
    const final = speech({ seq: 2, segmentId: 'corrected', startMs: 1100 });
    expect(
      reconcile(
        speech({ type: 'partial' }),
        final,
        speech({ type: 'partial', seq: 3, segmentId: 'late' }),
      ),
    ).toEqual([final]);
  });

  it('removes multiple partials covered by a final, preserving unrelated simultaneous speech', () => {
    const final = speech({
      seq: 3,
      segmentId: 'whole',
      startMs: 500,
      endMs: 3000,
    });
    const system = speech({ source: 'system', type: 'partial' });
    expect(
      reconcile(
        speech({ type: 'partial' }),
        speech({
          type: 'partial',
          seq: 2,
          segmentId: 'second',
          startMs: 2100,
          endMs: 2500,
        }),
        system,
        final,
      ),
    ).toEqual([final, system]);
  });

  it('does not replace distinct final speech with overlapping time ranges', () => {
    const a = speech();
    const b = speech({
      seq: 2,
      segmentId: 'other',
      startMs: 1100,
      text: 'Precisamos mudar o prazo de entrega.',
    });
    expect(reconcile(a, b)).toEqual([a, b]);
  });

  it('deduplicates replayed finals by ID or identical range/text within a source', () => {
    const original = speech();
    expect(
      reconcile(
        original,
        speech({ seq: 2, text: 'Não substituir um final' }),
        speech({ seq: 3, segmentId: 'duplicate' }),
      ),
    ).toEqual([original]);
  });

  it.each(['pt-BR', 'en-US'] as const)(
    'groups only final possible echoes in %s, independent of arrival order',
    (locale) => {
      const mic = speech({
        locale,
        text:
          locale === 'pt-BR'
            ? 'A revisão está pronta para entrega.'
            : 'The review is ready for delivery.',
      });
      const system = {
        ...mic,
        source: 'system' as const,
        startMs: 1100,
        endMs: 2100,
        text: mic.text.toUpperCase().normalize('NFD'),
      };
      expect(reconcile(mic, system)).toEqual([system]);
      expect(reconcile(system, mic)).toEqual([system]);
    },
  );

  it.each([
    { type: 'partial' as const },
    { locale: 'en-US' as const },
    { startMs: 1300, endMs: 2300 },
    { startMs: 2000, endMs: 3000 },
    { startMs: 1000, endMs: 1500 },
    { text: 'Precisamos revisar outro plano de entrega.' },
  ])(
    'preserves both sources when echo evidence is insufficient: %j',
    (changes) => {
      expect(
        reconcile(speech(), speech({ source: 'system', ...changes })),
      ).toHaveLength(2);
    },
  );

  it.each(['Sim.', 'OK', 'Um dois três', 'A B C D'])(
    'preserves short identical utterances: %s',
    (text) => {
      expect(
        reconcile(speech({ text }), speech({ source: 'system', text })),
      ).toHaveLength(2);
    },
  );

  it('preserves later repetitions and distinct simultaneous PT/EN text', () => {
    expect(
      reconcile(
        speech(),
        speech({
          source: 'system',
          text: 'We need to review the delivery plan.',
        }),
        speech({ seq: 2, segmentId: 'repeat', startMs: 3000, endMs: 4000 }),
      ),
    ).toHaveLength(3);
  });

  it('keeps original timestamps/text/source and returns defensive copies', () => {
    const reconciler = new TranscriptReconciler();
    const original = speech();
    reconciler.receive(original);
    original.text = 'Input mutation';
    const snapshot = reconciler.snapshot();
    const segment = snapshot[0];
    if (!segment) throw new Error('Missing segment');
    segment.text = 'Snapshot mutation';
    snapshot.pop();
    expect(reconciler.snapshot()).toEqual([speech()]);
  });

  it('bounds retention by time, rejects very late history, and resets the eviction boundary on clear', () => {
    const reconciler = new TranscriptReconciler();
    for (let i = 1; i <= 100; i++)
      reconciler.receive(
        speech({
          seq: i,
          segmentId: `s${i}`,
          startMs: i * 100,
          endMs: i * 100 + 50,
        }),
      );
    expect(reconciler.snapshot()).toHaveLength(MAX_VISIBLE_SEGMENTS);
    expect(reconciler.snapshot()[0]?.seq).toBe(89);
    reconciler.receive(
      speech({ seq: 101, segmentId: 'old', startMs: 100, endMs: 150 }),
    );
    expect(reconciler.snapshot().some((s) => s.segmentId === 'old')).toBe(
      false,
    );
    reconciler.clear();
    reconciler.receive(speech());
    expect(reconciler.snapshot()).toEqual([speech()]);
  });

  it('retains the original mic final behind echo grouping, within the fixed ceiling', () => {
    const reconciler = new TranscriptReconciler();
    const mic = speech({ startMs: 1100 });
    reconciler.receive(speech({ source: 'system' }));
    reconciler.receive(mic);
    // Evict the older system representative, then clear provisional speech.
    for (let i = 1; i < MAX_RETAINED_SEGMENTS; i++)
      reconciler.receive(
        speech({
          type: 'partial',
          seq: i + 1,
          segmentId: `p${i}`,
          startMs: 3000 + i * 100,
          endMs: 3050 + i * 100,
        }),
      );
    reconciler.discardPartials('mic');
    expect(reconciler.snapshot()).toEqual([mic]);
  });
});
