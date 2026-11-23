import { describe, expect, it } from 'vitest';
import type { MeetingResultUpdate } from '../../contracts/meeting/meetingResult';
import type { MeetingContext } from './ContextManager';
import { MeetingResultStore } from './MeetingResultStore';

function final(segmentId: string, text: string, startMs: number) {
  return {
    version: 1 as const,
    type: 'final' as const,
    sessionId: 'synthetic',
    source: 'system' as const,
    locale: 'pt-BR' as const,
    seq: startMs + 1,
    timestampMs: startMs + 1000,
    segmentId,
    startMs,
    endMs: startMs + 1000,
    text,
  };
}

const context: MeetingContext = {
  summary: [],
  recent: [
    final('one', 'O tema atual é a entrega.', 0),
    final('two', 'Decidimos lançar na sexta.', 1000),
    final('three', 'Correção: ainda não decidimos a data.', 2000),
  ],
};

function update(
  overrides: Partial<MeetingResultUpdate> = {},
): MeetingResultUpdate {
  return {
    operation: 'upsert',
    key: 'data-lancamento',
    kind: 'decision',
    text: 'Lançar na sexta.',
    groundedIn: 'meeting',
    evidence: [{ source: 'system', segmentId: 'two' }],
    ...overrides,
  };
}

describe('evidence-checked live result state', () => {
  it('handles absent, revised, contradicted and removed content deterministically', () => {
    const store = new MeetingResultStore();
    store.apply([], context);
    expect(store.snapshot()).toEqual({ items: [] });

    store.apply(
      [
        update(),
        update({
          key: 'tema-entrega',
          kind: 'topic',
          text: 'Entrega',
          evidence: [{ source: 'system', segmentId: 'one' }],
        }),
        update({
          key: 'sem-evidencia',
          kind: 'risk',
          text: 'Não deve entrar.',
          groundedIn: 'inference',
          evidence: [{ source: 'system', segmentId: 'inventado' }],
        }),
      ],
      context,
    );
    expect(store.snapshot().items.map(({ key }) => key)).toEqual([
      'tema-entrega',
      'data-lancamento',
    ]);
    expect(store.snapshot().items[1]?.evidence[0]).toMatchObject({
      text: 'Decidimos lançar na sexta.',
      startMs: 1000,
      endMs: 2000,
    });

    store.apply(
      [
        update({
          text: 'A data de lançamento está em aberto.',
          kind: 'question',
          groundedIn: 'meeting',
          evidence: [{ source: 'system', segmentId: 'three' }],
        }),
      ],
      context,
    );
    expect(store.snapshot().items[1]?.text).toBe('Lançar na sexta.');

    store.apply(
      [
        update({
          operation: 'remove',
          text: '',
          evidence: [{ source: 'system', segmentId: 'two' }],
        }),
        update({
          operation: 'remove',
          text: '',
          groundedIn: 'inference',
          evidence: [{ source: 'system', segmentId: 'three' }],
        }),
      ],
      context,
    );
    expect(store.snapshot().items[1]?.text).toBe('Lançar na sexta.');

    store.apply(
      [
        update({
          operation: 'remove',
          text: '',
          evidence: [{ source: 'system', segmentId: 'three' }],
        }),
      ],
      context,
    );
    expect(store.snapshot().items.map(({ key }) => key)).toEqual([
      'tema-entrega',
    ]);
  });

  it('replaces the current topic, corrects the same key and clears locally', () => {
    const store = new MeetingResultStore();
    store.apply(
      [
        update({
          key: 'tema-a',
          kind: 'topic',
          text: 'Entrega',
          evidence: [{ source: 'system', segmentId: 'one' }],
        }),
      ],
      context,
    );
    store.apply(
      [
        update({
          key: 'tema-b',
          kind: 'topic',
          text: 'Data de lançamento',
          groundedIn: 'inference',
          evidence: [{ source: 'system', segmentId: 'three' }],
        }),
      ],
      context,
    );
    expect(store.snapshot().items).toHaveLength(1);
    expect(store.snapshot().items[0]).toMatchObject({
      key: 'tema-b',
      groundedIn: 'inference',
    });
    store.clear();
    expect(store.snapshot()).toEqual({ items: [] });
  });
});
