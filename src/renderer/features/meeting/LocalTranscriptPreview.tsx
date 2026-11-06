import { useEffect, useRef } from 'react';
import type {
  LocalTranscriptSnapshot,
  ChannelEvent,
} from '../../../contracts/meeting/localTranscript';
import type { NativeErrorCode } from '../../../contracts/native/protocol';

const errors: Record<NativeErrorCode, string> = {
  'permission-denied': 'Permissão de captura não concedida pelo macOS.',
  unavailable: 'Transcrição Apple indisponível neste Mac.',
  'unsupported-locale': 'Idioma não suportado neste Mac.',
  'assets-unavailable': 'Modelos do idioma indisponíveis.',
  'capture-failed': 'A captura de áudio falhou.',
  'transcription-failed': 'O reconhecimento da fala falhou.',
  'invalid-command': 'Não foi possível controlar a captura.',
  internal: 'A transcrição local foi interrompida.',
};

function channelLabel(event: ChannelEvent | undefined): string {
  if (!event) return 'Preparando';
  switch (event.type) {
    case 'ready':
      return 'Pronta';
    case 'status':
      return event.state === 'paused' ? 'Pausada' : 'Ouvindo';
    case 'error':
      return errors[event.code];
    case 'stopped':
      return event.reason === 'error'
        ? 'Transcrição interrompida por erro.'
        : 'Encerrada';
  }
}

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
}: {
  transcript: LocalTranscriptSnapshot | null;
}) {
  const log = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (log.current && follow.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [transcript]);
  if (!transcript) return null;
  return (
    <section className="local-transcript" aria-label="Transcrição ao vivo">
      <h3>APPLE LOCAL (SWIFT)</h3>
      <p>Texto temporário neste Mac · sem envio à OpenAI</p>
      {transcript.failed &&
        !transcript.channels.some((channel) => channel.type === 'error') && (
          <p role="alert">
            A conexão com a transcrição local foi interrompida. Inicie uma nova
            sessão.
          </p>
        )}
      <ul className="transcript-sources" aria-label="Estado das fontes">
        {transcript.config.sources.map((source) => {
          const channel = transcript.channels.find(
            (event) => event.source === source,
          );
          const failed =
            channel?.type === 'error' ||
            (channel?.type === 'stopped' && channel.reason === 'error');
          return (
            <li key={source} role={failed ? 'alert' : 'status'}>
              {source === 'mic' ? 'Microfone' : 'Sistema'} ·{' '}
              {transcript.config.locale} ·{' '}
              {channel?.type === 'error'
                ? channelLabel(channel)
                : transcript.failed
                  ? 'Interrompida'
                  : channelLabel(channel)}
            </li>
          );
        })}
      </ul>
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
        aria-label="Falas recentes"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {transcript.segments.map((segment) => (
          <div
            className="transcript-segment"
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
      {transcript.segments.length === 0 && (
        <p>Nenhuma fala exibida nesta sessão.</p>
      )}
      <p className="transcript-note">
        Falas recentes em ordem de início, com tempos relativos à sessão. A
        fonte de áudio não identifica a pessoa. Finais iguais e próximos nas
        duas fontes podem ser agrupados como possível eco, exibindo Sistema;
        falas simultâneas iguais também podem ser agrupadas.
      </p>
    </section>
  );
}
