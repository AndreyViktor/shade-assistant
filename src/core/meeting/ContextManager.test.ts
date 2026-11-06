import { describe, expect, it } from 'vitest';
import { ContextManager, DEFAULT_CONTEXT_LIMITS } from './ContextManager';
import { estimateContextTokens } from './contextSummary';
import type { ContextLimits, ContextSnapshot } from './ContextManager';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';
import type { TranscriptionConfig } from '../../contracts/native/protocol';

const config: TranscriptionConfig = {
  sessionId: 'context-test',
  sources: ['mic', 'system'],
  locale: 'pt-BR',
};
function speech(
  seq: number,
  changes: Partial<SpeechSegment> = {},
): SpeechSegment {
  return {
    version: 1,
    sessionId: config.sessionId,
    source: 'mic',
    locale: 'pt-BR',
    seq,
    timestampMs: seq * 1000 + 500,
    type: 'final',
    segmentId: `segment-${seq}`,
    startMs: seq * 1000,
    endMs: seq * 1000 + 500,
    text: `Fala sintética número ${seq}.`,
    ...changes,
  };
}
function create(limits: Partial<ContextLimits> = {}): ContextManager {
  const manager = new ContextManager(limits);
  manager.start(config);
  return manager;
}
function snapshot(manager: ContextManager): ContextSnapshot {
  const value = manager.snapshot();
  if (!value) throw new Error('Expected active context');
  return value;
}
const texts = (manager: ContextManager) =>
  snapshot(manager).recent.map((s) => s.text);

describe('meeting context', () => {
  it('orders by speech time across sources, with stable ties independent of arrival', () => {
    const manager = create();
    const later = speech(1, {
      source: 'system',
      startMs: 3000,
      endMs: 4000,
      timestampMs: 5000,
    });
    const early = speech(1, { timestampMs: 5000 });
    const tied = speech(2, {
      source: 'system',
      startMs: 1000,
      endMs: 1500,
      timestampMs: 5000,
    });
    for (const event of [later, tied, early]) manager.receive(event);
    expect(snapshot(manager).recent).toEqual([early, tied, later]);
    // Source identity is retained even when text/timing match; no speaker inference.
    expect(snapshot(manager).recent.map((s) => s.source)).toEqual([
      'mic',
      'system',
      'system',
    ]);
  });

  it('replaces successive hypotheses, corrected IDs/times, and never regresses a final', () => {
    const manager = create();
    manager.receive(speech(1, { type: 'partial', text: 'Prazo sexta' }));
    manager.receive(
      speech(2, {
        type: 'partial',
        segmentId: 'segment-1',
        startMs: 1100,
        endMs: 1550,
        text: 'Prazo segunda',
      }),
    );
    expect(texts(manager)).toEqual(['Prazo segunda']);
    const final = speech(3, {
      startMs: 1150,
      endMs: 1600,
      text: 'Prazo confirmado: terça.',
    });
    manager.receive(final);
    manager.receive(
      speech(4, {
        type: 'partial',
        startMs: 1150,
        endMs: 1600,
        text: 'Hipótese obsoleta',
      }),
    );
    manager.receive({ ...final, seq: 5, text: 'Final alterado indevidamente' });
    expect(snapshot(manager).recent).toEqual([final]);
    manager.advanceTo(300_000);
    expect(snapshot(manager).summary.map((s) => s.text)).toEqual([
      'Prazo confirmado: terça.',
    ]);
  });

  it('reconciles covered partials while preserving another source and distinct overlapping finals', () => {
    const manager = create();
    manager.receive(speech(1, { type: 'partial' }));
    manager.receive(speech(2, { type: 'partial' }));
    const system = speech(1, { source: 'system', type: 'partial' });
    manager.receive(system);
    const final = speech(3, { startMs: 500, endMs: 3000 });
    manager.receive(final);
    const distinct = speech(4, {
      startMs: 1200,
      endMs: 1900,
      text: 'Outra fala simultânea',
    });
    manager.receive(distinct);
    expect(snapshot(manager).recent).toEqual([final, system, distinct]);
  });

  it('expires on the explicit session clock during silence, preserving the exact boundary', () => {
    const manager = create({ windowMs: 1000 });
    manager.receive(speech(1));
    manager.advanceTo(2000);
    expect(snapshot(manager).recent).toHaveLength(1);
    manager.advanceTo(2001);
    expect(snapshot(manager).recent).toEqual([]);
    expect(snapshot(manager).summary).toEqual([
      {
        source: 'mic',
        locale: 'pt-BR',
        segmentId: 'segment-1',
        startMs: 1000,
        endMs: 1500,
        text: 'Fala sintética número 1.',
        truncated: false,
      },
    ]);
    manager.advanceTo(0);
    expect(manager.receive(speech(2, { startMs: 1000, endMs: 1500 }))).toBe(
      false,
    );
    expect(snapshot(manager).summary).toHaveLength(1);
  });

  it('summarizes only evicted finals, retains recent verbatim speech and flags Unicode-safe cuts', () => {
    const manager = create({ maxSegments: 2, maxExcerptCodePoints: 4 });
    manager.receive(speech(1, { text: 'A😀界B resto' }));
    manager.receive(
      speech(2, { type: 'partial', text: 'Nunca persistir hipótese' }),
    );
    manager.receive(speech(3));
    manager.receive(speech(4));
    expect(snapshot(manager).summary).toMatchObject([
      { text: 'A😀界B', truncated: true },
    ]);
    expect(snapshot(manager).recent).toEqual([speech(3), speech(4)]);
    manager.advanceTo(300_000);
    expect(JSON.stringify(snapshot(manager))).not.toContain('Nunca persistir');
  });

  it('closes all tied sources on pressure and rejects late history without growing a seen-ID set', () => {
    const manager = create({ maxSegments: 2 });
    manager.receive(speech(1));
    manager.receive(speech(1, { source: 'system' }));
    manager.receive(speech(2));
    expect(snapshot(manager).recent).toEqual([speech(2)]);
    expect(snapshot(manager).summary).toHaveLength(2);
    expect(manager.receive(speech(3, { startMs: 1000, endMs: 1500 }))).toBe(
      false,
    );
    expect(snapshot(manager).summary).toHaveLength(2);
  });

  it('deduplicates higher-sequence finals with identical range/text before summarization', () => {
    const manager = create();
    manager.receive(speech(1));
    manager.receive(
      speech(2, {
        startMs: 1000,
        endMs: 1500,
        text: 'FALA SINTÉTICA NÚMERO 1!',
      }),
    );
    manager.advanceTo(300_000);
    expect(snapshot(manager).summary).toHaveLength(1);
  });

  it('keeps only the latest bounded summary entries in chronological order', () => {
    const manager = create({ maxSegments: 1, maxSummaryEntries: 2 });
    for (let i = 1; i <= 6; i++) manager.receive(speech(i));
    expect(snapshot(manager).summary.map((s) => s.segmentId)).toEqual([
      'segment-4',
      'segment-5',
    ]);
    expect(snapshot(manager).recent).toEqual([speech(6)]);
  });

  it('limits summary bytes independently of the entry count', () => {
    const manager = create({ maxSegments: 1, maxSummaryEstimatedTokens: 256 });
    for (let i = 1; i <= 6; i++) manager.receive(speech(i));
    expect(snapshot(manager).summary).toHaveLength(1);
    expect(snapshot(manager).summary[0]?.segmentId).toBe('segment-5');
    expect(
      estimateContextTokens(snapshot(manager).summary),
    ).toBeLessThanOrEqual(256);
  });

  it('drops an excerpt that cannot fit and still retains the next recent final', () => {
    const manager = create({
      maxSegments: 1,
      maxSummaryEstimatedTokens: 256,
    });
    manager.receive(speech(1, { text: '界'.repeat(240) }));
    manager.receive(speech(2));
    expect(snapshot(manager).summary).toEqual([]);
    expect(snapshot(manager).recent).toEqual([speech(2)]);
  });

  it('inserts late speech only after the archived boundary and keeps both timelines ordered', () => {
    const manager = create({ maxSegments: 2 });
    manager.receive(speech(1));
    manager.receive(speech(3));
    manager.receive(speech(4));
    const late = speech(1, {
      source: 'system',
      startMs: 2000,
      endMs: 2500,
      timestampMs: 4500,
    });
    expect(manager.receive(late)).toBe(true);
    expect(snapshot(manager).summary.map((entry) => entry.startMs)).toEqual([
      1000, 2000,
    ]);
    expect(snapshot(manager).recent).toEqual([speech(3), speech(4)]);
    expect(manager.receive({ ...late, seq: 2 })).toBe(false);
    expect(snapshot(manager).summary).toHaveLength(2);
  });

  it('prioritizes recent speech over summary and accounts for metadata in the total budget', () => {
    const manager = create({
      maxEstimatedTokens: 600,
      maxSummaryEstimatedTokens: 256,
      maxSegments: 1,
    });
    manager.receive(speech(1));
    const latest = speech(2, { text: 'x'.repeat(350) });
    manager.receive(latest);
    const value = snapshot(manager);
    expect(value.recent).toEqual([latest]);
    expect(value.summary).toEqual([]);
    expect(value.estimatedTokens).toBe(
      new TextEncoder().encode(
        JSON.stringify({ recent: value.recent, summary: value.summary }),
      ).length,
    );
    expect(value.estimatedTokens).toBeLessThanOrEqual(600);
  });

  it('handles a single oversized final as a marked excerpt and drops an oversized partial', () => {
    const manager = create({
      maxEstimatedTokens: 700,
      maxSummaryEstimatedTokens: 600,
      maxExcerptCodePoints: 50,
    });
    manager.receive(speech(1, { text: '界'.repeat(4096) }));
    expect(snapshot(manager).recent).toEqual([]);
    expect(snapshot(manager).summary).toMatchObject([
      { text: '界'.repeat(50), truncated: true },
    ]);
    manager.receive(speech(2, { type: 'partial', text: '😀'.repeat(2048) }));
    expect(snapshot(manager).recent).toEqual([]);
    expect(snapshot(manager).summary).toEqual([]);
    expect(snapshot(manager).estimatedTokens).toBeLessThanOrEqual(700);
  });

  it('does not count only characters or words: UTF-8 and JSON escapes consume budget', () => {
    expect(estimateContextTokens('a')).toBe(3);
    expect(estimateContextTokens('á')).toBe(4);
    expect(estimateContextTokens('界')).toBe(5);
    expect(estimateContextTokens('😀')).toBe(6);
    expect(estimateContextTokens('\n')).toBe(4);
    expect(estimateContextTokens('"')).toBe(4);
  });

  it('bounds retained content throughout 2,000 events with revisions, Unicode and two sources', () => {
    const limits = {
      maxSegments: 8,
      maxEstimatedTokens: 4000,
      maxSummaryEstimatedTokens: 600,
      maxSummaryEntries: 3,
    };
    const manager = create(limits);
    for (let i = 1; i <= 1000; i++) {
      const base = speech(i * 2, {
        source: i % 2 === 0 ? 'system' : 'mic',
        text: 'Áudio sintético 😀界'.repeat(20),
      });
      manager.receive({ ...base, seq: base.seq - 1, type: 'partial' });
      manager.receive(base);
      const value = snapshot(manager);
      expect(value.recent.length).toBeLessThanOrEqual(limits.maxSegments);
      expect(value.summary.length).toBeLessThanOrEqual(
        limits.maxSummaryEntries,
      );
      expect(value.estimatedTokens).toBeLessThanOrEqual(
        limits.maxEstimatedTokens,
      );
      expect(estimateContextTokens(value.summary)).toBeLessThanOrEqual(
        limits.maxSummaryEstimatedTokens,
      );
      expect(
        value.recent.every(
          (s) =>
            s.startMs >= base.timestampMs - DEFAULT_CONTEXT_LIMITS.windowMs,
        ),
      ).toBe(true);
    }
    expect(JSON.stringify(snapshot(manager))).not.toContain('"segment-2"');
    manager.clear();
    expect(manager.snapshot()).toBeNull();
    manager.start(config);
    expect(snapshot(manager)).toMatchObject({ recent: [], summary: [] });
    expect(manager.receive(speech(1))).toBe(true);
  });

  it('ignores wrong session, locale, source and stale/duplicate sequences without advancing time', () => {
    const manager = create();
    manager.start({ ...config, sources: ['mic'] });
    manager.receive(speech(1));
    const before = snapshot(manager);
    for (const changes of [
      { sessionId: 'old' },
      { locale: 'en-US' as const },
      { source: 'system' as const },
      { seq: 1 },
    ])
      expect(manager.receive(speech(300, changes))).toBe(false);
    expect(snapshot(manager)).toEqual(before);
  });

  it('pauses one source, discards its partials and rejects late speech until listening', () => {
    const manager = create();
    manager.receive(speech(1));
    manager.receive(speech(2, { type: 'partial' }));
    manager.receive(speech(1, { source: 'system', type: 'partial' }));
    const status = {
      version: 1,
      sessionId: config.sessionId,
      source: 'mic',
      locale: 'pt-BR',
      seq: 3,
      timestampMs: 4000,
      type: 'status',
      state: 'paused',
    };
    manager.receive(status);
    expect(snapshot(manager).recent.map((s) => [s.source, s.type])).toEqual([
      ['mic', 'final'],
      ['system', 'partial'],
    ]);
    expect(manager.receive(speech(4))).toBe(false);
    manager.receive({
      ...status,
      seq: 5,
      timestampMs: 5500,
      state: 'listening',
    });
    expect(manager.receive(speech(6))).toBe(true);
    expect(snapshot(manager).recent.at(-1)).toEqual(speech(6));
  });

  it.each([
    { type: 'error', code: 'capture-failed' },
    { type: 'stopped', reason: 'completed' },
  ])('clears all context and rejects late events on $type', (terminal) => {
    const manager = create({ maxSegments: 1 });
    manager.receive(speech(1));
    manager.receive(speech(2));
    manager.receive({
      version: 1,
      sessionId: config.sessionId,
      source: 'mic',
      locale: 'pt-BR',
      seq: 3,
      timestampMs: 3500,
      ...terminal,
    });
    expect(manager.snapshot()).toBeNull();
    expect(manager.receive(speech(4))).toBe(false);
  });

  it('copies input/config/snapshots and clears history when starting a new session', () => {
    const manager = create({ maxSegments: 1 });
    const inputConfig = { ...config, sources: [...config.sources] };
    manager.start(inputConfig);
    inputConfig.sources.pop();
    const event = speech(1);
    manager.receive(event);
    event.text = 'mutated';
    manager.receive(speech(2, { source: 'system' }));
    const value = snapshot(manager);
    expect(value.summary[0]?.text).toBe('Fala sintética número 1.');
    const recent = value.recent[0];
    const summary = value.summary[0];
    if (!recent || !summary) throw new Error('Missing fixture content');
    recent.text = 'mutated';
    summary.text = 'mutated';
    value.recent.pop();
    value.summary.pop();
    expect(snapshot(manager).recent).toEqual([speech(2, { source: 'system' })]);
    expect(snapshot(manager).summary[0]?.text).toBe('Fala sintética número 1.');
    manager.start({ ...config, sessionId: 'new' });
    expect(snapshot(manager)).toMatchObject({ recent: [], summary: [] });
    expect(manager.receive(speech(3))).toBe(false);
  });

  it('validates malformed or oversized events before state changes, with no payload in errors', () => {
    const manager = create();
    manager.receive(speech(1));
    const before = snapshot(manager);
    for (const invalid of [
      { ...speech(2), text: 'SENSITIVE'.repeat(1000) },
      { ...speech(2), startMs: -1 },
      { ...speech(2), version: 99 },
      { ...speech(2), text: '\uD800' },
      { ...speech(2), unexpected: 'SENSITIVE' },
    ])
      expect(() => manager.receive(invalid)).toThrow(
        /^Native protocol: (invalid-message|unsupported-version)$/,
      );
    expect(snapshot(manager)).toEqual(before);
  });

  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid session time: %s',
    (time) => {
      expect(() => create().advanceTo(time)).toThrow('Invalid context time');
    },
  );

  it.each([
    { windowMs: 0 },
    { maxSegments: -1 },
    { maxSegments: 129 },
    { maxSegments: 1.5 },
    { maxEstimatedTokens: Infinity },
    { maxEstimatedTokens: 511 },
    { maxSummaryEstimatedTokens: 255 },
    { maxEstimatedTokens: 2000, maxSummaryEstimatedTokens: 2000 },
    { maxExcerptCodePoints: NaN },
  ])('rejects invalid or unbounded limits: %j', (limits) => {
    expect(() => new ContextManager(limits)).toThrow('Invalid context limits');
  });
});
