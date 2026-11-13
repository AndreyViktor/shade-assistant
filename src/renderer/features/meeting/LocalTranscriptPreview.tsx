import { useEffect, useRef } from 'react';
import type { LocalTranscriptSnapshot } from '../../../contracts/meeting/localTranscript';
import {
  channelLabel,
  hasTranscriptionFailure,
} from './TranscriptionDiagnostics';

function sessionTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  const milliseconds = Math.floor(ms % 1000)
    .toString()
    .padStart(3, '0');
  return `${minutes}:${remainder}.${milliseconds}`;
}

export function LocalTranscriptPreview({
  transcript,
  error = false,
}: {
  transcript: LocalTranscriptSnapshot | null;
  error?: boolean;
}) {
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (log.current && follow.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [transcript]);
  const failed = error || hasTranscriptionFailure(transcript);
  return (
    <section
      className={`local-transcript${failed ? ' area-failed' : ''}`}
      aria-label="Transcrição ao vivo"
    >
      <h3>Transcrição ao vivo</h3>
      {failed && (
        <p className="area-error" role="alert">
          <span aria-hidden="true">⚠</span> Falha na transcrição. Consulte
          Preferências.
        </p>
      )}
      {transcript && (
        <ul className="transcript-sources" aria-label="Estado das fontes">
          {transcript.config.sources.map((source) => {
            const channel = transcript.channels.find(
              (event) => event.source === source,
            );
            return (
              <li key={source} role="status">
                {source === 'mic' ? 'Microfone' : 'Sistema'} ·{' '}
                {transcript.config.locale} ·{' '}
                {transcript.failed ||
                channel?.type === 'error' ||
                (channel?.type === 'stopped' && channel.reason === 'error')
                  ? 'Interrompida'
                  : channelLabel(channel)}
              </li>
            );
          })}
        </ul>
      )}
      <div
        ref={log}
        onScroll={(event) => {
          const element = event.currentTarget;
          follow.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            32;
        }}
        className="transcript-segments"
        role="log"
        tabIndex={0}
        aria-label="Falas recentes"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {(!transcript || transcript.segments.length === 0) && (
          <p>Nenhuma fala exibida nesta sessão.</p>
        )}
        {transcript?.segments.map((segment) => (
          <div
            className={`transcript-segment transcript-segment-${segment.source}`}
            key={`${segment.source}:${segment.segmentId}`}
          >
            <p className="transcript-metadata">
              {segment.source === 'mic' ? 'Microfone' : 'Sistema'} ·{' '}
              {segment.locale} ·{' '}
              {segment.type === 'partial' ? 'Parcial' : 'Final'}
              {' · '}
              <span aria-label="Intervalo desde o início da sessão">
                {sessionTime(segment.startMs)}–{sessionTime(segment.endMs)}
              </span>
            </p>
            <p>{segment.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
