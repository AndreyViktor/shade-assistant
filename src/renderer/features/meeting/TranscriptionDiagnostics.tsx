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

export function channelLabel(event: ChannelEvent | undefined): string {
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

export function hasTranscriptionFailure(
  transcript: LocalTranscriptSnapshot | null,
): boolean {
  return Boolean(
    transcript?.failed ||
    transcript?.channels.some(
      (channel) =>
        channel.type === 'error' ||
        (channel.type === 'stopped' && channel.reason === 'error'),
    ),
  );
}

export function TranscriptionDiagnostics({
  transcript,
  error,
}: {
  transcript: LocalTranscriptSnapshot | null;
  error: string;
}) {
  return (
    <section
      className="suggestion-diagnostics"
      aria-label="Estado da transcrição"
    >
      <h3>Estado da transcrição</h3>
      {error && <p>{error}</p>}
      {transcript ? (
        <>
          {transcript.failed && (
            <p>
              A conexão com a transcrição local foi interrompida. Inicie uma
              nova sessão.
            </p>
          )}
          <ul aria-label="Detalhes das fontes">
            {transcript.config.sources.map((source) => (
              <li key={source}>
                {source === 'mic' ? 'Microfone' : 'Sistema'} ·{' '}
                {transcript.config.locale} ·{' '}
                {channelLabel(
                  transcript.channels.find(
                    (channel) => channel.source === source,
                  ),
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Nenhuma transcrição local disponível.</p>
      )}
    </section>
  );
}
