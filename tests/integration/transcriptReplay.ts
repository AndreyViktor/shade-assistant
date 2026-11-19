import type { SpeechSegment } from '../../src/contracts/meeting/localTranscript';
import type { TranscriptionLocale } from '../../src/contracts/native/protocol';

/** Invented text and session-relative times; not measured speech recognition. */
export function transcriptReplay(
  locale: TranscriptionLocale = 'pt-BR',
): SpeechSegment[] {
  const systemPhrase =
    locale === 'pt-BR'
      ? 'Precisamos revisar o plano de entrega amanhã.'
      : 'We need to review the delivery plan tomorrow.';
  const microphoneEcho =
    locale === 'pt-BR'
      ? 'Precisamos revisar nosso plano para entrega amanhã.'
      : 'We need to review our delivery plan tomorrow.';
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
    timestampMs: 12_000,
  });
  return [
    event(
      'system',
      1,
      'final',
      'later',
      5500,
      6500,
      'Depois conferimos o resultado.',
    ),
    event('mic', 1, 'partial', 'draft', 1900, 4800, 'Precisamos revisar'),
    event('system', 2, 'final', 'early', 1000, 4000, systemPhrase),
    event('mic', 2, 'final', 'corrected', 1900, 5000, microphoneEcho),
    event('mic', 3, 'partial', 'stale', 1950, 4950, 'Hipótese atrasada'),
    event(
      'mic',
      4,
      'final',
      'overlap',
      2200,
      3900,
      'O deployment precisa de revisão.',
    ),
    event('mic', 5, 'final', 'short', 6800, 7000, 'Sim.'),
    event('system', 3, 'final', 'short', 6800, 7000, 'Sim.'),
    event('mic', 6, 'final', 'repeat', 8000, 9000, systemPhrase),
    event(
      'mic',
      7,
      'partial',
      'pause-draft',
      10_000,
      10_500,
      'Revisão temporária',
    ),
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
