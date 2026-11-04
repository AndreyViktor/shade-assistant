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
});
