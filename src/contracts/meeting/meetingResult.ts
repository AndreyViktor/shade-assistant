import { isProtocolId, isProtocolTime } from '../native/protocol';
import type { AudioSource } from '../native/protocol';
import { hasExactKeys } from '../validation';

export const MEETING_RESULT_KINDS = [
  'topic',
  'decision',
  'action',
  'question',
  'risk',
] as const;
export type MeetingResultKind = (typeof MEETING_RESULT_KINDS)[number];
export type MeetingResultGrounding = 'meeting' | 'inference';
export const MEETING_RESULT_TEXT_LIMIT = 240;
export const MEETING_RESULT_KEY_LIMIT = 64;
export const MEETING_RESULT_EVIDENCE_LIMIT = 3;
export const MEETING_RESULT_UPDATE_LIMIT = 12;
export const MEETING_RESULT_ITEM_LIMIT_PER_KIND = 4;
export const MEETING_RESULT_ITEM_LIMIT =
  1 + (MEETING_RESULT_KINDS.length - 1) * MEETING_RESULT_ITEM_LIMIT_PER_KIND;

export type MeetingEvidenceReference = {
  source: AudioSource;
  segmentId: string;
};

export type MeetingResultUpdate = {
  operation: 'upsert' | 'remove';
  key: string;
  kind: MeetingResultKind;
  text: string;
  groundedIn: MeetingResultGrounding;
  evidence: MeetingEvidenceReference[];
};

export type MeetingResultEvidence = MeetingEvidenceReference & {
  startMs: number;
  endMs: number;
  text: string;
  truncated: boolean;
};

export type MeetingResultItem = Omit<
  MeetingResultUpdate,
  'operation' | 'evidence'
> & {
  evidence: MeetingResultEvidence[];
};

export type MeetingResultsSnapshot = { items: MeetingResultItem[] };

export function emptyMeetingResults(): MeetingResultsSnapshot {
  return { items: [] };
}

export function isMeetingResultKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MEETING_RESULT_KEY_LIMIT &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

export function parseMeetingResultUpdates(
  value: unknown,
): MeetingResultUpdate[] | null {
  if (!Array.isArray(value) || value.length > MEETING_RESULT_UPDATE_LIMIT)
    return null;
  const updates: MeetingResultUpdate[] = [];
  for (const item of value) {
    const update = parseMeetingResultUpdate(item);
    if (!update) return null;
    updates.push(update);
  }
  return updates;
}

export function parseMeetingResults(
  value: unknown,
): MeetingResultsSnapshot | null {
  if (
    !hasExactKeys(value, ['items']) ||
    !Array.isArray(value.items) ||
    value.items.length > MEETING_RESULT_ITEM_LIMIT
  )
    return null;
  const items: MeetingResultItem[] = [];
  for (const valueItem of value.items) {
    const item = parseMeetingResultItem(valueItem);
    if (
      !item ||
      items.some(({ key }) => key === item.key) ||
      (item.kind === 'topic' && items.some(({ kind }) => kind === 'topic')) ||
      items.filter(({ kind }) => kind === item.kind).length >=
        MEETING_RESULT_ITEM_LIMIT_PER_KIND
    )
      return null;
    items.push(item);
  }
  return { items };
}

function parseMeetingResultUpdate(value: unknown): MeetingResultUpdate | null {
  if (
    !hasExactKeys(value, [
      'operation',
      'key',
      'kind',
      'text',
      'groundedIn',
      'evidence',
    ]) ||
    (value.operation !== 'upsert' && value.operation !== 'remove') ||
    !isMeetingResultKey(value.key) ||
    !isMeetingResultKind(value.kind) ||
    typeof value.text !== 'string' ||
    value.text.length > MEETING_RESULT_TEXT_LIMIT ||
    (value.operation === 'upsert' && !value.text.trim()) ||
    (value.operation === 'remove' && value.text !== '') ||
    (value.operation === 'remove' && value.groundedIn !== 'meeting') ||
    (value.groundedIn !== 'meeting' && value.groundedIn !== 'inference') ||
    (value.kind === 'decision' && value.groundedIn !== 'meeting')
  )
    return null;
  const evidence = parseEvidenceReferences(value.evidence);
  if (!evidence || evidence.length === 0) return null;
  return {
    operation: value.operation,
    key: value.key,
    kind: value.kind,
    text: value.text,
    groundedIn: value.groundedIn,
    evidence,
  };
}

function parseMeetingResultItem(value: unknown): MeetingResultItem | null {
  if (
    !hasExactKeys(value, ['key', 'kind', 'text', 'groundedIn', 'evidence']) ||
    !isMeetingResultKey(value.key) ||
    !isMeetingResultKind(value.kind) ||
    typeof value.text !== 'string' ||
    !value.text.trim() ||
    value.text.length > MEETING_RESULT_TEXT_LIMIT ||
    (value.groundedIn !== 'meeting' && value.groundedIn !== 'inference') ||
    (value.kind === 'decision' && value.groundedIn !== 'meeting') ||
    !Array.isArray(value.evidence) ||
    value.evidence.length === 0 ||
    value.evidence.length > MEETING_RESULT_EVIDENCE_LIMIT
  )
    return null;
  const evidence: MeetingResultEvidence[] = [];
  for (const raw of value.evidence) {
    if (
      !hasExactKeys(raw, [
        'source',
        'segmentId',
        'startMs',
        'endMs',
        'text',
        'truncated',
      ]) ||
      (raw.source !== 'mic' && raw.source !== 'system') ||
      !isProtocolId(raw.segmentId) ||
      !isProtocolTime(raw.startMs) ||
      !isProtocolTime(raw.endMs) ||
      raw.startMs > raw.endMs ||
      typeof raw.text !== 'string' ||
      !raw.text.trim() ||
      raw.text.length > MEETING_RESULT_TEXT_LIMIT ||
      typeof raw.truncated !== 'boolean'
    )
      return null;
    evidence.push({
      source: raw.source,
      segmentId: raw.segmentId,
      startMs: raw.startMs,
      endMs: raw.endMs,
      text: raw.text,
      truncated: raw.truncated,
    });
  }
  return {
    key: value.key,
    kind: value.kind,
    text: value.text,
    groundedIn: value.groundedIn,
    evidence,
  };
}

function parseEvidenceReferences(
  value: unknown,
): MeetingEvidenceReference[] | null {
  if (!Array.isArray(value) || value.length > MEETING_RESULT_EVIDENCE_LIMIT)
    return null;
  const evidence: MeetingEvidenceReference[] = [];
  for (const item of value) {
    if (
      !hasExactKeys(item, ['source', 'segmentId']) ||
      (item.source !== 'mic' && item.source !== 'system') ||
      !isProtocolId(item.segmentId) ||
      evidence.some(
        ({ source, segmentId }) =>
          source === item.source && segmentId === item.segmentId,
      )
    )
      return null;
    evidence.push({ source: item.source, segmentId: item.segmentId });
  }
  return evidence;
}

function isMeetingResultKind(value: unknown): value is MeetingResultKind {
  return MEETING_RESULT_KINDS.some((kind) => kind === value);
}
