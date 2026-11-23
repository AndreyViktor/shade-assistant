import type { Preferences } from '../../../contracts/settings/preferences';
import { SuggestionCards } from '../suggestions/SuggestionCards';
import { StartSessionDialog } from './StartSessionDialog';
import type { SuggestionAuthorization } from '../../../contracts/meeting/suggestionSession';
import { LocalTranscriptPreview } from './LocalTranscriptPreview';
import { useRef, useState } from 'react';
import type {
  AudioSource,
  TranscriptionLocale,
} from '../../../contracts/native/protocol';
import type { useMeetingSession } from './useMeetingSession';
import { StructuredMeetingResults } from './StructuredMeetingResults';
import { SESSION_IPC_VERSION } from '../../../contracts/ipc/session';

type SourceChoice = Preferences['audioSource'];

const phaseLabels = {
  idle: 'Pronta para iniciar',
  running: 'Em andamento',
  paused: 'Pausada',
  stopped: 'Encerrada',
};

const sourceNames: Record<SourceChoice, string> = {
  mic: 'microfone',
  system: 'áudio do sistema',
  both: 'microfone e áudio do sistema',
};

function selectedSources(choice: SourceChoice): AudioSource[] {
  return choice === 'both' ? ['mic', 'system'] : [choice];
}

export function SessionControls({
  savedPreferences,
  meeting,
  available = true,
  appError = '',
}: {
  meeting: ReturnType<typeof useMeetingSession>;
  savedPreferences?: Preferences | null;
  available?: boolean;
  appError?: string;
}) {
  const {
    session,
    local,
    suggestions,
    results,
    busy,
    error,
    preferences,
    command,
  } = meeting;
  const locale: TranscriptionLocale =
    (savedPreferences ?? preferences)?.language === 'en-US' ? 'en-US' : 'pt-BR';
  const source = (savedPreferences ?? preferences)?.audioSource ?? 'both';
  const [confirming, setConfirming] = useState(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const canStart =
    available && (session?.phase === 'idle' || session?.phase === 'stopped');
  const localActive =
    session?.mode === 'apple-local' &&
    (session.phase === 'running' || session.phase === 'paused');
  const attempt = suggestions.diagnostics?.lastAttempt;
  const suggestionsFailed =
    suggestions.status !== 'disabled' &&
    (suggestions.status === 'unavailable' ||
      Boolean(
        attempt &&
        !['pending', 'success', 'empty', 'cancelled'].includes(attempt.result),
      ));

  function startLocal(): void {
    if (!canStart || busy) return;
    setConfirming(true);
  }

  function confirmLocalConsent(authorization?: SuggestionAuthorization): void {
    setConfirming(false);
    void command({
      version: SESSION_IPC_VERSION,
      action: 'start',
      options: {
        mode: 'apple-local',
        consent: {
          capture: true,
          context: Boolean(authorization),
          remoteAudio: false,
        },
        ...(authorization ? { suggestions: authorization } : {}),
        locale,
        sources: selectedSources(source),
      },
    });
  }

  if (
    session?.mode === 'demo' &&
    (session.phase === 'running' || session.phase === 'paused')
  ) {
    return (
      <section className="session-controls" aria-label="Simulação ativa">
        <h2>DEMO · simulação offline</h2>
        <p role="status">
          Uma demonstração está ativa. Abra Preferências → Diagnóstico para
          consultar o roteiro ou retomar a simulação. Sem captura ou envio de
          dados.
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          disabled={busy}
          onClick={() => {
            void command({ version: SESSION_IPC_VERSION, action: 'stop' });
          }}
        >
          Parar DEMO
        </button>
      </section>
    );
  }

  return (
    <section className="session-controls" aria-label="Controles da reunião">
      <div className="session-toolbar">
        <div className="session-heading">
          <p role="status">
            {session ? phaseLabels[session.phase] : 'Verificando…'}
          </p>
        </div>

        <div className="session-actions">
          {!localActive && (
            <button
              ref={startButton}
              className="primary-action"
              disabled={busy || !canStart}
              onClick={startLocal}
            >
              Iniciar transcrição local
            </button>
          )}
          {session?.phase === 'running' && (
            <button
              disabled={busy}
              onClick={() => {
                void command({
                  version: SESSION_IPC_VERSION,
                  action: 'pause',
                });
              }}
            >
              Pausar
            </button>
          )}
          {session?.phase === 'paused' && (
            <button
              disabled={busy}
              onClick={() => {
                void command({
                  version: SESSION_IPC_VERSION,
                  action: 'resume',
                });
              }}
            >
              Retomar
            </button>
          )}
          {(session?.phase === 'running' ||
            session?.phase === 'paused' ||
            Boolean(error)) && (
            <button
              disabled={busy}
              onClick={() => {
                void command({
                  version: SESSION_IPC_VERSION,
                  action: 'stop',
                });
              }}
            >
              Parar
            </button>
          )}
        </div>
      </div>

      {session?.mode === 'apple-local' && session.phase !== 'stopped' ? (
        <p className="capture-status" role="status">
          Captura {session.phase === 'paused' ? 'pausada' : 'ativa'} de{' '}
          {local?.config.sources.map((item) => sourceNames[item]).join(' e ') ??
            sourceNames[source]}
          . O áudio é processado neste Mac.
        </p>
      ) : (
        <p className="capture-description">
          O áudio fica neste Mac. Nenhum áudio é enviado à nuvem.
        </p>
      )}

      <div className="meeting-workspace">
        <LocalTranscriptPreview
          transcript={local}
          error={Boolean(error || appError)}
        />
        <section
          className={`meeting-assistance${suggestionsFailed ? ' area-failed' : ''}`}
          aria-label="Assistência da reunião"
          tabIndex={0}
        >
          {suggestionsFailed && (
            <p className="area-error" role="alert">
              <span aria-hidden="true">⚠</span> Falha nas sugestões. Consulte
              Preferências.
            </p>
          )}
          {localActive && suggestions.status !== 'disabled' ? (
            <>
              <StructuredMeetingResults snapshot={results} />
              <SuggestionCards
                demo={false}
                suggestions={suggestions.items}
                busy={busy}
                onDismiss={(id) => {
                  void command({
                    version: SESSION_IPC_VERSION,
                    action: 'dismiss-suggestion',
                    id,
                  });
                }}
              />
              <p role="status">
                Sugestões OpenAI: {suggestions.remainingRequests} chamadas
                restantes nesta sessão.
                {suggestions.remainingRequests === 0 && ' Limite atingido.'}
              </p>
              <button
                disabled={busy}
                onClick={() => {
                  void command({
                    version: SESSION_IPC_VERSION,
                    action: 'revoke-suggestions',
                  });
                }}
              >
                Desativar sugestões
              </button>
            </>
          ) : (
            <>
              <h3>Assistência</h3>
              <p>
                Sugestões e resultados ao vivo desativados. A transcrição
                continua disponível neste painel.
              </p>
            </>
          )}
        </section>
      </div>

      {confirming && (
        <StartSessionDialog
          source={sourceNames[source]}
          language={locale === 'pt-BR' ? 'Português (Brasil)' : 'Inglês (EUA)'}
          onCancel={() => {
            setConfirming(false);
            startButton.current?.focus();
          }}
          onStart={confirmLocalConsent}
        />
      )}
    </section>
  );
}
