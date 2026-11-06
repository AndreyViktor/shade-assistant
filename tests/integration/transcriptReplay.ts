import type { SpeechSegment } from '../../src/contracts/meeting/localTranscript';
import type { TranscriptionLocale } from '../../src/contracts/native/protocol';

/** Invented text and session-relative times; not measured speech recognition. */
export function transcriptReplay(
  locale: TranscriptionLocale = 'pt-BR',
): SpeechSegment[] {
  const phrase =
    locale === 'pt-BR'
      ? 'Precisamos revisar o plano de entrega.'
      : 'We need to review the delivery plan.';
  const base = { version: 1 as const, sessionId: 'replay', locale };
  const event = (
    source: SpeechSegment['source'],
    seq: number,
    type: SpeechSegment['type'],
    segmentId: string,
    startMs: number,
    endMs: number,
    text: string,
  ): SpeechSegment => ({
    ...base,
    source,
    seq,
    type,
    segmentId,
    startMs,
    endMs,
    text,
    timestampMs: 10_000,
  });
  return [
    event(
      'system',
      1,
      'final',
      'later',
      3000,
      4000,
      'Depois conferimos o resultado.',
    ),
    event('mic', 1, 'partial', 'draft', 1100, 1900, 'Precisamos revisar'),
    event('system', 2, 'final', 'early', 1000, 2000, phrase),
    event('mic', 2, 'final', 'corrected', 1000, 2000, phrase),
    event('mic', 3, 'partial', 'stale', 1050, 1950, 'Hipótese atrasada'),
    event(
      'mic',
      4,
      'final',
      'overlap',
      1200,
      1900,
      'O deployment precisa de revisão.',
    ),
    event('mic', 5, 'final', 'short', 4200, 4400, 'Sim.'),
    event('system', 3, 'final', 'short', 4200, 4400, 'Sim.'),
    event('mic', 6, 'final', 'repeat', 6000, 7000, phrase),
    event('mic', 7, 'partial', 'pause-draft', 8000, 8500, 'Revisão temporária'),
  ];
}

export const reconciledReplayIds = [
  'early',
  'overlap',
  'later',
  'short',
  'short',
  'repeat',
  'pause-draft',
];
