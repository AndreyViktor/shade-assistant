import { describe, expect, it } from 'vitest';
import { SuggestionStore } from './SuggestionStore';
import { SUGGESTION_CATEGORIES } from '../../contracts/meeting/suggestion';
import type { SuggestionContent } from '../../contracts/meeting/suggestion';

const content: SuggestionContent = {
  category: 'question',
  title: 'Contexto',
  body: 'Qual é o prazo?',
  groundedIn: 'inference',
};
function setup(ttl = 30000) {
  let now = 1000;
  return {
    store: new SuggestionStore(() => now, ttl),
    advance: (ms: number) => {
      now += ms;
    },
  };
}
describe('session suggestion policy', () => {
  it('starts silent and retains only the two newest cards, with all four categories', () => {
    const { store } = setup();
    expect(store.snapshot()).toEqual([]);
    for (const category of SUGGESTION_CATEGORIES) {
      expect(
        store.add(category, { ...content, category, body: category }),
      ).toBe(true);
      expect(store.snapshot().length).toBeLessThanOrEqual(2);
      expect(store.snapshot().at(-1)?.category).toBe(category);
    }
    expect(store.snapshot().map(({ id }) => id)).toEqual(['warning', 'action']);
    store.dismiss('action');
    expect(store.snapshot().map(({ id }) => id)).toEqual(['warning']);
  });
  it('rejects duplicate IDs and normalized content without extending expiry or relabeling it', () => {
    const { store, advance } = setup();
    store.add('one', content);
    advance(10000);
    expect(store.add('one', { ...content, body: 'Different' })).toBe(false);
    expect(
      store.add('two', {
        ...content,
        category: 'warning',
        title: 'Other',
        body: '  QUAL É   O PRAZO?  ',
      }),
    ).toBe(false);
    expect(store.snapshot()).toEqual([
      { ...content, id: 'one', expiresAt: 31000 },
    ]);
    advance(20000);
    expect(store.snapshot()).toEqual([]);
    expect(store.add('two', content)).toBe(true);
  });
  it('keeps dismissed and evicted duplicates suppressed for their original lifetime', () => {
    const { store, advance } = setup();
    store.add('one', content);
    store.dismiss('one');
    store.dismiss('missing');
    expect(store.add('two', content)).toBe(false);
    expect(store.snapshot()).toEqual([]);
    store.add('three', { ...content, body: 'third' });
    store.add('four', { ...content, body: 'fourth' });
    store.add('five', { ...content, body: 'fifth' });
    expect(store.add('six', { ...content, body: 'third' })).toBe(false);
    advance(30000);
    expect(store.add('two', content)).toBe(true);
  });
  it('expires each card exactly at its deadline, including when nothing new arrives', () => {
    const { store, advance } = setup();
    store.add('one', content);
    advance(5000);
    store.add('two', { ...content, body: 'Second' });
    advance(24999);
    expect(store.snapshot()).toHaveLength(2);
    advance(1);
    expect(store.snapshot().map(({ id }) => id)).toEqual(['two']);
    advance(5000);
    expect(store.snapshot()).toEqual([]);
  });
  it('returns isolated snapshots and clears cards plus suppression at stop', () => {
    const { store } = setup();
    const input = { ...content };
    store.add('one', input);
    input.body = 'mutated';
    const snapshot = store.snapshot();
    if (snapshot[0]) snapshot[0].body = 'mutated';
    snapshot.pop();
    expect(store.snapshot()[0]?.body).toBe(content.body);
    store.clear();
    expect(store.snapshot()).toEqual([]);
    expect(store.add('one', content)).toBe(true);
  });
  it('accepts a configured lifetime and rejects invalid policies', () => {
    const { store, advance } = setup(50);
    store.add('one', content);
    advance(50);
    expect(store.snapshot()).toEqual([]);
    for (const ttl of [0, -1, 1.5, Infinity, NaN])
      expect(() => new SuggestionStore(Date.now, ttl)).toThrow(
        'Invalid suggestion lifetime',
      );
  });
  it('invalidates visible cards while preserving suppression until the original deadline', () => {
    const { store, advance } = setup();
    store.add('one', content);
    advance(10000);
    store.invalidate();
    expect(store.snapshot()).toEqual([]);
    expect(store.add('two', content)).toBe(false);
    advance(19999);
    expect(store.add('two', content)).toBe(false);
    advance(1);
    expect(store.add('two', content)).toBe(true);
  });
});

describe('retained real session cards', () => {
  it('ignores elapsed time and clock changes, deduplicates and dismisses without restoring evicted cards', () => {
    let now = 1000;
    const store = new SuggestionStore(() => now, null);
    store.add('one', content);
    const first = store.snapshot();
    for (const time of [31000, 3601000, -1000]) {
      now = time;
      expect(store.snapshot()).toEqual(first);
      expect(
        store.add('duplicate', { ...content, body: ' QUAL É   O PRAZO? ' }),
      ).toBe(false);
      expect(store.add('one', { ...content, body: 'Changed' })).toBe(false);
    }
    store.add('two', { ...content, body: 'Second' });
    store.add('three', { ...content, body: 'Third' });
    expect(store.snapshot().map(({ id }) => id)).toEqual(['two', 'three']);
    store.dismiss('missing');
    store.dismiss('three');
    expect(store.snapshot().map(({ id }) => id)).toEqual(['two']);
    expect(store.add('repeated', content)).toBe(false);
    expect(store.add('repeated', { ...content, body: 'Third' })).toBe(false);
    store.clear();
    expect(store.snapshot()).toEqual([]);
    expect(store.add('one', content)).toBe(true);
    expect(store.snapshot()).toEqual([
      { ...content, id: 'one', expiresAt: null },
    ]);
  });

  it('bounds suppression to the last 100 insertions and keeps only two cards without a hidden queue', () => {
    const store = new SuggestionStore(Date.now, null);
    for (let i = 0; i < 100; i++)
      expect(store.add(`id-${i}`, { ...content, body: `Body ${i}` })).toBe(
        true,
      );
    expect(store.add('repeat', { ...content, body: 'Body 0' })).toBe(false);
    expect(store.add('id-100', { ...content, body: 'Body 100' })).toBe(true);
    expect(store.add('repeat', { ...content, body: 'Body 1' })).toBe(false);
    expect(store.add('id-0', { ...content, body: 'Body 0' })).toBe(true);
    expect(store.snapshot().map(({ id }) => id)).toEqual(['id-100', 'id-0']);
    store.dismiss('id-100');
    store.dismiss('id-0');
    expect(store.snapshot()).toEqual([]);
  });
});
