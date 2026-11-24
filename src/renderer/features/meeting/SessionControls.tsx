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
import { SuggestionFeedbackSummary } from '../suggestions/SuggestionFeedbackSummary';

type SourceChoice = Preferences['audioSource'];

export type OverlayMode = 'complete' | 'transcript' | 'assistance';

const overlayModes: { mode: OverlayMode; label: string; icon: string }[] = [
  { mode: 'complete', label: 'Visualização completa', icon: 'columns' },
  { mode: 'transcript', label: 'Só transcrição', icon: 'text' },
  { mode: 'assistance', label: 'Só assistência', icon: 'assistance' },
];

function ModeIcon({ icon }: { icon: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {icon === 'columns' ? (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M12 4v16" />
        </>
      ) : icon === 'text' ? (
        <>
          <path d="M4 6h16M4 10h16M4 14h12M4 18h14" />
        </>
      ) : (
        <>
          <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8-4.8-1.7 4.8-1.7L12 3zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" />
        </>
      )}
    </svg>
  );
}

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
  overlayMode = 'complete',
  onOverlayModeChange,
  available = true,
  appError = '',
}: {
  meeting: ReturnType<typeof useMeetingSession>;
  overlayMode?: OverlayMode;
  onOverlayModeChange?: (mode: OverlayMode) => void;
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

  const captureIndicator =
    session?.mode === 'apple-local' && session.phase !== 'stopped' ? (
      <p className="capture-status" role="status">
        Captura {session.phase === 'paused' ? 'pausada' : 'ativa'} de{' '}
        {local?.config.sources.map((item) => sourceNames[item]).join(' e ') ??
          sourceNames[source]}
        . O áudio é processado neste Mac.
      </p>
    ) : (
      <p className="capture-description">
        Captura inativa. O áudio fica neste Mac e não é enviado à nuvem.
      </p>
    );

  const modePicker = (
    <fieldset className="overlay-mode-picker">
      <legend>Visualização do overlay</legend>
      <div className="overlay-mode-actions">
        {overlayModes.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            aria-label={label}
            aria-pressed={overlayMode === mode}
            onClick={() => onOverlayModeChange?.(mode)}
          >
            <ModeIcon icon={icon} />
            <span className="overlay-mode-tooltip" aria-hidden="true">
              {label}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );

  if (
    session?.mode === 'demo' &&
    (session.phase === 'running' || session.phase === 'paused')
  ) {
    return (
      <section
        className={`session-controls overlay-mode-${overlayMode}`}
        aria-label="Simulação ativa"
      >
        {modePicker}
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
    <section
      className={`session-controls overlay-mode-${overlayMode}`}
      aria-label="Controles da reunião"
    >
      {modePicker}
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

      {captureIndicator}

      <div className={`meeting-workspace meeting-workspace-${overlayMode}`}>
        {overlayMode !== 'assistance' && (
          <LocalTranscriptPreview
            transcript={local}
            error={Boolean(error || appError)}
          />
        )}
        {overlayMode !== 'transcript' ? (
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
                  ratings={suggestions.feedback.ratings}
                  onRate={(id, feedback) => {
                    void command({
                      version: SESSION_IPC_VERSION,
                      action: 'rate-suggestion',
                      id,
                      feedback,
                    });
                  }}
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
                  continua disponível na visualização de transcrição.
                </p>
              </>
            )}
          </section>
        ) : null}
      </div>

      {overlayMode !== 'transcript' && (
        <SuggestionFeedbackSummary
          feedback={suggestions.feedback}
          busy={busy}
          onExport={() => {
            void command({
              version: SESSION_IPC_VERSION,
              action: 'export-suggestion-feedback',
            });
          }}
          onClear={() => {
            void command({
              version: SESSION_IPC_VERSION,
              action: 'clear-suggestion-feedback',
            });
          }}
        />
      )}

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
