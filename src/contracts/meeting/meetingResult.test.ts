import { describe, expect, it } from 'vitest';
import {
  MEETING_RESULT_ITEM_LIMIT_PER_KIND,
  parseMeetingResults,
  parseMeetingResultUpdates,
} from './meetingResult';

const reference = { source: 'system', segmentId: 'segment-1' } as const;
const update = {
  operation: 'upsert',
  key: 'prazo-aberto',
  kind: 'question',
  text: 'Qual é o prazo?',
  groundedIn: 'meeting',
  evidence: [reference],
} as const;
const evidence = {
  ...reference,
  startMs: 1000,
  endMs: 2000,
  text: 'Qual é o prazo?',
  truncated: false,
};

describe('structured meeting result contracts', () => {
  it('accepts evidence-bearing upserts/removals and a bounded snapshot', () => {
    expect(
      parseMeetingResultUpdates([
        update,
        {
          ...update,
          operation: 'remove',
          text: '',
          groundedIn: 'meeting',
        },
      ]),
    ).toHaveLength(2);
    const item = {
      key: update.key,
      kind: update.kind,
      text: update.text,
      groundedIn: update.groundedIn,
      evidence: [evidence],
    };
    expect(parseMeetingResults({ items: [item] })).toEqual({ items: [item] });
  });

  it.each([
    [{ ...update, evidence: [] }],
    [{ ...update, key: 'Prazo aberto' }],
    [{ ...update, kind: 'decision', groundedIn: 'inference' }],
    [{ ...update, operation: 'remove', text: 'inventado' }],
    [
      {
        ...update,
        operation: 'remove',
        text: '',
        groundedIn: 'inference',
      },
    ],
    [{ ...update, evidence: [reference, reference] }],
    [{ ...update, extra: true }],
  ])('rejects unsafe model update %#', (value) => {
    expect(parseMeetingResultUpdates(value)).toBeNull();
  });

  it('rejects duplicate keys, multiple topics and per-kind overflow', () => {
    const item = {
      key: update.key,
      kind: update.kind,
      text: update.text,
      groundedIn: update.groundedIn,
      evidence: [evidence],
    };
    expect(parseMeetingResults({ items: [item, item] })).toBeNull();
    expect(
      parseMeetingResults({
        items: [
          { ...item, key: 'topico-a', kind: 'topic' },
          { ...item, key: 'topico-b', kind: 'topic' },
        ],
      }),
    ).toBeNull();
    expect(
      parseMeetingResults({
        items: Array.from(
          { length: MEETING_RESULT_ITEM_LIMIT_PER_KIND + 1 },
          (_, index) => ({ ...item, key: `risco-${index}`, kind: 'risk' }),
        ),
      }),
    ).toBeNull();
  });
});
