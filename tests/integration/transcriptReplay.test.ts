import { expect, it } from 'vitest';
import { LocalTranscript } from '../../src/core/transcription/LocalTranscript';
import { parseLocalTranscript } from '../../src/contracts/meeting/localTranscript';
import { parseTranscriptionEvent } from '../../src/contracts/native/protocol';
import { reconciledReplayIds, transcriptReplay } from './transcriptReplay';

it.each(['pt-BR', 'en-US'] as const)(
  'replays two sources with revisions, overlap, repetition and pause in %s',
  (locale) => {
    const transcript = new LocalTranscript();
    transcript.start({
      sessionId: 'replay',
      sources: ['mic', 'system'],
      locale,
    });
    for (const event of transcriptReplay(locale)) {
      transcript.receive(
        parseTranscriptionEvent(JSON.parse(JSON.stringify(event))),
        true,
      );
      expect(parseLocalTranscript(transcript.snapshot())).toEqual(
        transcript.snapshot(),
      );
    }
    expect(
      transcript.snapshot()?.segments.map((event) => event.segmentId),
    ).toEqual(reconciledReplayIds);
    transcript.receive(
      {
        version: 1,
        sessionId: 'replay',
        source: 'mic',
        locale,
        seq: 8,
        timestampMs: 11_000,
        type: 'status',
        state: 'paused',
      },
      false,
    );
    expect(
      transcript.snapshot()?.segments.map((event) => event.segmentId),
    ).toEqual(reconciledReplayIds.slice(0, -1));
    transcript.receive(
      {
        version: 1,
        sessionId: 'replay',
        source: 'mic',
        locale,
        seq: 9,
        timestampMs: 12_000,
        type: 'final',
        segmentId: 'paused',
        startMs: 11_000,
        endMs: 12_000,
        text: 'Fala ignorada',
      },
      false,
    );
    expect(transcript.snapshot()?.segments).toHaveLength(6);
    transcript.clear();
    expect(transcript.snapshot()).toBeNull();
  },
);
