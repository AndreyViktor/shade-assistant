import type {
  Suggestion,
  SuggestionContent,
} from '../../contracts/meeting/suggestion';

// Cosmetic differences are duplicates; semantic similarity is deliberately not inferred.
function fingerprint(content: SuggestionContent): string {
  return content.body
    .normalize('NFKC')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/gu, ' ');
}

/** Session-local cards. No persistence, timers, network or UI dependencies. */
export class SuggestionStore {
  private cards: Suggestion[] = [];
  private recent: { id: string; fingerprint: string; expiresAt: number }[] = [];

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = 30000,
  ) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0)
      throw new Error('Invalid suggestion lifetime');
  }

  add(id: string, content: SuggestionContent): boolean {
    this.prune();
    const key = fingerprint(content);
    if (this.recent.some((item) => item.id === id || item.fingerprint === key))
      return false;
    const expiresAt = this.now() + this.ttlMs;
    this.cards = [...this.cards, { ...content, id, expiresAt }].slice(-2);
    // Bounded suppression includes dismissed/evicted cards for their original lifetime.
    this.recent = [...this.recent, { id, fingerprint: key, expiresAt }].slice(
      -100,
    );
    return true;
  }

  dismiss(id: string): void {
    this.prune();
    this.cards = this.cards.filter((card) => card.id !== id);
  }

  snapshot(): Suggestion[] {
    this.prune();
    return this.cards.map((card) => ({ ...card }));
  }

  clear(): void {
    this.cards = [];
    this.recent = [];
  }

  private prune(): void {
    const now = this.now();
    this.cards = this.cards.filter((card) => card.expiresAt > now);
    this.recent = this.recent.filter((item) => item.expiresAt > now);
  }
}
