import { hasExactKeys } from '../validation';
import {
  parseNativeCommand,
  parseTranscriptionEvent,
} from '../native/protocol';
import type {
  TranscriptionConfig,
  TranscriptionEvent,
} from '../native/protocol';

export const MAX_VISIBLE_SEGMENTS = 12;
export type SpeechSegment = Extract<
  TranscriptionEvent,
  { type: 'partial' | 'final' }
>;
export type ChannelEvent = Exclude<TranscriptionEvent, SpeechSegment>;
export type LocalTranscriptSnapshot = {
  failed: boolean;
  config: TranscriptionConfig;
  channels: ChannelEvent[];
  segments: SpeechSegment[];
};

/** Throws at the IPC boundary; callers return a fixed INVALID_RESPONSE code. */
export function parseLocalTranscript(
  value: unknown,
): LocalTranscriptSnapshot | null {
  if (value === null) return null;
  if (
    !hasExactKeys(value, ['config', 'channels', 'segments', 'failed']) ||
    typeof value.failed !== 'boolean' ||
    !hasExactKeys(value.config, ['sessionId', 'sources', 'locale']) ||
    !Array.isArray(value.channels) ||
    value.channels.length > 2 ||
    !Array.isArray(value.segments) ||
    value.segments.length > MAX_VISIBLE_SEGMENTS
  )
    throw new Error('Invalid local transcript');
  const command = parseNativeCommand({
    ...value.config,
    version: 1,
    type: 'start',
  });
  if (command.type !== 'start') throw new Error('Invalid local transcript');
  const config = {
    sessionId: command.sessionId,
    sources: command.sources,
    locale: command.locale,
  };
  const parse = (item: unknown) => {
    const event = parseTranscriptionEvent(item);
    if (
      event.sessionId !== config.sessionId ||
      event.locale !== config.locale ||
      !config.sources.includes(event.source)
    )
      throw new Error('Invalid local transcript');
    return event;
  };
  const channels = value.channels.map(parse);
  const segments = value.segments.map(parse);
  if (
    !channels.every(isChannelEvent) ||
    new Set(channels.map((event) => event.source)).size !== channels.length ||
    !segments.every(isSpeechSegment) ||
    new Set(segments.map((event) => `${event.source}:${event.segmentId}`))
      .size !== segments.length
  )
    throw new Error('Invalid local transcript');
  return { config, channels, segments, failed: value.failed };
}

export function isSpeechSegment(
  event: TranscriptionEvent,
): event is SpeechSegment {
  return event.type === 'partial' || event.type === 'final';
}
function isChannelEvent(event: TranscriptionEvent): event is ChannelEvent {
  return !isSpeechSegment(event);
}
