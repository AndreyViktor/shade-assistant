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
    'groups final possible echoes in %s despite timing and word differences',
    (locale) => {
      const mic = speech({
        locale,
        startMs: 1000,
        endMs: 4000,
        text:
          locale === 'pt-BR'
            ? 'Precisamos revisar o plano de entrega amanhã.'
            : 'We need to review the delivery plan tomorrow.',
      });
      const system = {
        ...mic,
        source: 'system' as const,
        startMs: 2100,
        endMs: 5000,
        text:
          locale === 'pt-BR'
            ? 'PRECISAMOS REVISAR NOSSO PLANO PARA ENTREGA AMANHÃ!'.normalize(
                'NFD',
              )
            : 'We need to review our delivery plan tomorrow!',
      };
      expect(reconcile(mic, system)).toEqual([system]);
      expect(reconcile(system, mic)).toEqual([system]);
    },
  );

  it('suppresses one mic final represented by consecutive system finals', () => {
    const mic = speech({
      startMs: 1200,
      endMs: 7200,
      text: 'Precisamos revisar nosso plano para entrega amanhã antes da reunião.',
    });
    const first = speech({
      source: 'system',
      startMs: 1000,
      endMs: 3900,
      text: 'Precisamos revisar o plano de entrega amanhã.',
    });
    const second = speech({
      source: 'system',
      seq: 2,
      segmentId: 'system-second',
      startMs: 4000,
      endMs: 7000,
      text: 'Isso deve acontecer antes da reunião.',
    });
    expect(reconcile(mic, first, second)).toEqual([first, second]);
    expect(reconcile(second, mic, first)).toEqual([first, second]);
  });

  it('suppresses consecutive mic fragments contained in one system final', () => {
    const system = speech({
      source: 'system',
      startMs: 1000,
      endMs: 7000,
      text: 'Precisamos revisar o plano de entrega amanhã antes da reunião.',
    });
    const first = speech({
      startMs: 1200,
      endMs: 3900,
      text: 'Precisamos revisar o plano de entrega.',
    });
    const second = speech({
      seq: 2,
      segmentId: 'mic-second',
      startMs: 4000,
      endMs: 6800,
      text: 'Entrega amanhã antes da reunião.',
    });
    expect(reconcile(first, system, second)).toEqual([system]);
  });

  it('keeps partials even when their text and timing match system playback', () => {
    const partial = speech({ type: 'partial' });
    const system = speech({ source: 'system' });
    expect(reconcile(partial, system)).toEqual([partial, system]);
  });

  it.each([
    {
      text: 'Entrega plano o revisar precisamos amanhã de.',
    },
    {
      startMs: 5000,
      endMs: 8000,
    },
    {
      text: 'Precisamos revisar o plano e confirmar riscos adicionais importantes.',
    },
  ])(
    'preserves a mic final without ordered text and timing support: %j',
    (changes) => {
      const mic = speech({
        startMs: 1000,
        endMs: 4000,
        text: 'Precisamos revisar o plano de entrega amanhã.',
        ...changes,
      });
      const system = speech({
        source: 'system',
        startMs: 1000,
        endMs: 4000,
        text: 'Precisamos revisar o plano de entrega amanhã.',
      });
      const result = reconcile(mic, system);
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([mic, system]));
    },
  );

  it.each([
    { type: 'partial' as const },
    { locale: 'en-US' as const },
    { startMs: 2600, endMs: 3600 },
    { startMs: 2400, endMs: 3400 },
    { startMs: 1000, endMs: 1500 },
    { text: 'Precisamos avaliar riscos financeiros desta proposta.' },
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

  it('preserves distinct simultaneous speech even with matching generic words', () => {
    expect(
      reconcile(
        speech({
          startMs: 1000,
          endMs: 4000,
          text: 'Precisamos revisar o plano de entrega amanhã.',
        }),
        speech({
          source: 'system',
          startMs: 1800,
          endMs: 4500,
          text: 'Precisamos avaliar os riscos financeiros desta proposta.',
        }),
      ),
    ).toHaveLength(2);
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
