import { hasExactKeys } from '../validation';

export const NATIVE_PROTOCOL_VERSION = 1;
export const MAX_JSONL_BYTES = 16_384;
export const MAX_TRANSCRIPT_LENGTH = 4_096; // UTF-16 code units in both languages.
export type AudioSource = 'mic' | 'system';
export type TranscriptionLocale = 'pt-BR' | 'en-US';
export type TranscriptionConfig = {
  sessionId: string;
  sources: AudioSource[];
  locale: TranscriptionLocale;
};
export type NativeCommand = { version: 1; sessionId: string } & (
  | { type: 'start'; sources: AudioSource[]; locale: TranscriptionLocale }
  | { type: 'pause' | 'resume' | 'stop' }
);
export const NATIVE_ERROR_CODES = [
  'permission-denied',
  'unavailable',
  'unsupported-locale',
  'assets-unavailable',
  'capture-failed',
  'transcription-failed',
  'invalid-command',
  'internal',
] as const;
export type NativeErrorCode = (typeof NATIVE_ERROR_CODES)[number];
export type TranscriptionEvent = {
  version: 1;
  sessionId: string;
  source: AudioSource;
  locale: TranscriptionLocale;
  seq: number;
  timestampMs: number;
} & (
  | { type: 'ready'; supportsPartial: boolean }
  | {
      type: 'partial' | 'final';
      segmentId: string;
      startMs: number;
      endMs: number;
      text: string;
    }
  | { type: 'status'; state: 'listening' | 'paused' }
  | { type: 'error'; code: NativeErrorCode }
  | { type: 'stopped'; reason: 'completed' | 'cancelled' | 'error' }
);

export type ProtocolErrorCode =
  | 'invalid-message'
  | 'unsupported-version'
  | 'line-too-large'
  | 'invalid-json'
  | 'invalid-utf8'
  | 'truncated-line'
  | 'invalid-order'
  | 'incomplete-stream'
  | 'closed-stream';

// Only fixed codes cross the error boundary; never attach raw input/cause.
export class NativeProtocolError extends Error {
  constructor(readonly code: ProtocolErrorCode) {
    super(`Native protocol: ${code}`);
    this.name = 'NativeProtocolError';
  }
}

export function isProtocolId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}
export function isProtocolTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function isSource(value: unknown): value is AudioSource {
  return value === 'mic' || value === 'system';
}
function isLocale(value: unknown): value is TranscriptionLocale {
  return value === 'pt-BR' || value === 'en-US';
}
function invalid(): never {
  throw new NativeProtocolError('invalid-message');
}
function checkVersion(value: unknown): void {
  if (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version !== 1
  )
    throw new NativeProtocolError('unsupported-version');
}

export function parseNativeCommand(value: unknown): NativeCommand {
  checkVersion(value);
  if (
    hasExactKeys(value, ['version', 'sessionId', 'type', 'sources', 'locale'])
  ) {
    if (
      value.version === 1 &&
      value.type === 'start' &&
      isProtocolId(value.sessionId) &&
      isLocale(value.locale) &&
      Array.isArray(value.sources) &&
      value.sources.length >= 1 &&
      value.sources.length <= 2 &&
      value.sources.every(isSource) &&
      new Set(value.sources).size === value.sources.length
    )
      return {
        version: 1,
        type: 'start',
        sessionId: value.sessionId,
        sources: [...value.sources],
        locale: value.locale,
      };
  } else if (hasExactKeys(value, ['version', 'sessionId', 'type'])) {
    if (
      value.version === 1 &&
      isProtocolId(value.sessionId) &&
      (value.type === 'pause' ||
        value.type === 'resume' ||
        value.type === 'stop')
    )
      return { version: 1, sessionId: value.sessionId, type: value.type };
  }
  return invalid();
}

const envelopeKeys = [
  'version',
  'sessionId',
  'source',
  'locale',
  'seq',
  'timestampMs',
  'type',
];
export function parseTranscriptionEvent(value: unknown): TranscriptionEvent {
  checkVersion(value);
  if (typeof value !== 'object' || value === null) return invalid();
  const type = 'type' in value ? value.type : undefined;
  const extras =
    type === 'ready'
      ? ['supportsPartial']
      : type === 'partial' || type === 'final'
        ? ['segmentId', 'startMs', 'endMs', 'text']
        : type === 'status'
          ? ['state']
          : type === 'error'
            ? ['code']
            : type === 'stopped'
              ? ['reason']
              : null;
  if (
    !extras ||
    !hasExactKeys(value, [...envelopeKeys, ...extras]) ||
    value.version !== 1 ||
    !isProtocolId(value.sessionId) ||
    !isSource(value.source) ||
    !isLocale(value.locale) ||
    !isProtocolTime(value.seq) ||
    value.seq === 0 ||
    !isProtocolTime(value.timestampMs)
  )
    return invalid();
  const base = {
    version: NATIVE_PROTOCOL_VERSION as typeof NATIVE_PROTOCOL_VERSION,
    sessionId: value.sessionId,
    source: value.source,
    locale: value.locale,
    seq: value.seq,
    timestampMs: value.timestampMs,
  };
  switch (value.type) {
    case 'ready':
      if (typeof value.supportsPartial === 'boolean')
        return {
          ...base,
          type: 'ready',
          supportsPartial: value.supportsPartial,
        };
      break;
    case 'partial':
    case 'final':
      if (
        isProtocolId(value.segmentId) &&
        isProtocolTime(value.startMs) &&
        isProtocolTime(value.endMs) &&
        value.startMs <= value.endMs &&
        value.endMs <= value.timestampMs &&
        typeof value.text === 'string' &&
        !/[\uD800-\uDFFF]/u.test(value.text) &&
        value.text.trim().length > 0 &&
        value.text.length <= MAX_TRANSCRIPT_LENGTH
      )
        return {
          ...base,
          type: value.type,
          segmentId: value.segmentId,
          startMs: value.startMs,
          endMs: value.endMs,
          text: value.text,
        };
      break;
    case 'status':
      if (value.state === 'listening' || value.state === 'paused')
        return { ...base, type: 'status', state: value.state };
      break;
    case 'error': {
      const code = NATIVE_ERROR_CODES.find(
        (candidate) => candidate === value.code,
      );
      if (code) return { ...base, type: 'error', code };
      break;
    }
    case 'stopped':
      if (
        value.reason === 'completed' ||
        value.reason === 'cancelled' ||
        value.reason === 'error'
      )
        return { ...base, type: 'stopped', reason: value.reason };
  }
  return invalid();
}

export function encodeNativeCommand(command: NativeCommand): Uint8Array {
  return new TextEncoder().encode(
    `${JSON.stringify(parseNativeCommand(command))}\n`,
  );
}
