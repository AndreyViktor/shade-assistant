import {
  MEETING_RESULT_ITEM_LIMIT_PER_KIND,
  MEETING_RESULT_TEXT_LIMIT,
} from '../../contracts/meeting/meetingResult';
import type {
  MeetingResultEvidence,
  MeetingResultItem,
  MeetingResultsSnapshot,
  MeetingResultUpdate,
} from '../../contracts/meeting/meetingResult';
import type { MeetingContext } from './ContextManager';

/** Session-local, evidence-checked structured results. Model references have no
 * authority until they resolve to final speech in the exact dispatched context.
 */
export class MeetingResultStore {
  private items: MeetingResultItem[] = [];

  apply(updates: MeetingResultUpdate[], context: MeetingContext): void {
    const evidenceIndex = new Map<string, MeetingResultEvidence>();
    for (const segment of [
      ...context.summary,
      ...context.recent.filter((item) => item.type === 'final'),
    ]) {
      const text = truncateEvidence(segment.text);
      evidenceIndex.set(`${segment.source}:${segment.segmentId}`, {
        source: segment.source,
        segmentId: segment.segmentId,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text,
        truncated:
          ('truncated' in segment && segment.truncated) ||
          text.length < segment.text.length,
      });
    }
    for (const update of updates) {
      const evidence = update.evidence.map((reference) =>
        evidenceIndex.get(`${reference.source}:${reference.segmentId}`),
      );
      if (evidence.some((item) => !item)) continue;
      const resolved = evidence.filter((item): item is MeetingResultEvidence =>
        Boolean(item),
      );
      const existingIndex = this.items.findIndex(
        ({ key }) => key === update.key,
      );
      if (update.operation === 'remove') {
        const existing = this.items[existingIndex];
        const latestExistingStart = Math.max(
          ...(existing?.evidence.map(({ startMs }) => startMs) ?? []),
        );
        if (
          update.groundedIn === 'meeting' &&
          existing?.kind === update.kind &&
          resolved.some(({ startMs }) => startMs > latestExistingStart)
        )
          this.items.splice(existingIndex, 1);
        continue;
      }
      const item: MeetingResultItem = {
        key: update.key,
        kind: update.kind,
        text: update.text,
        groundedIn: update.groundedIn,
        evidence: resolved,
      };
      if (existingIndex >= 0) {
        if (this.items[existingIndex]?.kind === update.kind)
          this.items[existingIndex] = item;
        continue;
      }
      if (update.kind === 'topic') {
        this.items = this.items.filter(({ kind }) => kind !== 'topic');
        this.items.unshift(item);
        continue;
      }
      if (
        this.items.filter(({ kind }) => kind === update.kind).length >=
        MEETING_RESULT_ITEM_LIMIT_PER_KIND
      )
        continue;
      this.items.push(item);
    }
  }

  snapshot(): MeetingResultsSnapshot {
    return {
      items: this.items.map((item) => ({
        ...item,
        evidence: item.evidence.map((evidence) => ({ ...evidence })),
      })),
    };
  }

  clear(): void {
    this.items = [];
  }
}

function truncateEvidence(text: string): string {
  if (text.length <= MEETING_RESULT_TEXT_LIMIT) return text;
  let result = text.slice(0, MEETING_RESULT_TEXT_LIMIT);
  if (/\p{Surrogate}$/u.test(result)) result = result.slice(0, -1);
  return result;
}
