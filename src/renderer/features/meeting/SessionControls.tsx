import type { Preferences } from '../../../contracts/settings/preferences';
import { SuggestionCards } from '../suggestions/SuggestionCards';
import { suggestionFailureMessages } from '../suggestions/SuggestionDiagnosticsPanel';
import { StartSessionDialog } from './StartSessionDialog';
import type { SuggestionAuthorization } from '../../../contracts/meeting/suggestionSession';
import { LocalTranscriptPreview } from './LocalTranscriptPreview';
import { useRef, useState, type ReactNode } from 'react';
import { PanelIcon } from '../../ui/PanelIcon';
import type {
  AudioSource,
  TranscriptionLocale,
} from '../../../contracts/native/protocol';
import type { useMeetingSession } from './useMeetingSession';
import { StructuredMeetingResults } from './StructuredMeetingResults';
import { SESSION_IPC_VERSION } from '../../../contracts/ipc/session';
import { SuggestionFeedbackSummary } from '../suggestions/SuggestionFeedbackSummary';
import { OverlayViewPicker, type OverlayMode } from './OverlayViewPicker';

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
  overlayMode = 'complete',
  onOverlayModeChange,
  preferencesButton,
  available = true,
  appError = '',
}: {
  meeting: ReturnType<typeof useMeetingSession>;
  overlayMode?: OverlayMode;
  onOverlayModeChange?: (mode: OverlayMode) => void;
  preferencesButton?: ReactNode;
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
      <section
        className="session-controls demo-session"
        aria-label="Simulação ativa"
      >
        <h2>DEMO · simulação offline</h2>
        <p role="status">
          Uma demonstração está ativa. Abra Preferências → Diagnóstico para
          consultar o roteiro ou retomar a simulação. Sem captura ou envio de
          dados.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="session-actions">
          {preferencesButton}
          <button
            disabled={busy}
            onClick={() => {
              void command({ version: SESSION_IPC_VERSION, action: 'stop' });
            }}
          >
            Parar DEMO
          </button>
        </div>
      </section>
    );
  }

  const sources = localActive ? local?.config.sources : selectedSources(source);
  const sessionLocale = localActive && local ? local.config.locale : locale;
  const sourceLabel = sources
    ?.map((item) => (item === 'mic' ? 'Microfone' : 'Sistema'))
    .join(' + ');
  const languageLabel =
    sessionLocale === 'pt-BR' ? 'Português (Brasil)' : 'Inglês (EUA)';
  const assistanceEnabled = localActive && suggestions.status !== 'disabled';

  return (
    <section
      className={`session-controls overlay-mode-${overlayMode}`}
      aria-label="Controles da reunião"
    >
      <div className="session-toolbar">
        <div className="session-heading">
          <span className="session-symbol">
            <PanelIcon name="audioLines" />
          </span>
          <div>
            <div className="session-title">
              <h1>Sessão local</h1>
              <span
                className="session-phase"
                data-phase={session?.phase}
                role="status"
              >
                {session
                  ? phaseLabels[session.phase]
                  : error || appError
                    ? 'Indisponível'
                    : 'Verificando…'}
              </span>
            </div>
            {sourceLabel &&
              (localActive || savedPreferences || preferences) && (
                <p className="source-summary">
                  {sourceLabel} · {languageLabel}
                </p>
              )}
          </div>
        </div>

        <div className="session-actions">
          {!localActive && (
            <button
              ref={startButton}
              className="primary-action"
              disabled={busy || !canStart}
              onClick={startLocal}
            >
              <PanelIcon name="play" />
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
              <PanelIcon name="pause" />
              Pausar
            </button>
          )}
          {session?.phase === 'paused' && (
            <button
              className="primary-action"
              disabled={busy}
              onClick={() => {
                void command({
                  version: SESSION_IPC_VERSION,
                  action: 'resume',
                });
              }}
            >
              <PanelIcon name="play" />
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
              <PanelIcon name="square" />
              Parar
            </button>
          )}
        </div>
      </div>

      <div className="workspace-tools">
        <OverlayViewPicker
          selected={overlayMode}
          onChange={onOverlayModeChange}
        />
        {preferencesButton}
      </div>

      <div className={`meeting-workspace meeting-workspace-${overlayMode}`}>
        {overlayMode !== 'assistance' && (
          <LocalTranscriptPreview
            transcript={local}
            phase={session?.phase}
            error={Boolean(error || appError)}
          />
        )}
        {overlayMode !== 'transcript' ? (
          <section
            className={`meeting-assistance${assistanceEnabled ? '' : ' assistance-idle'}${suggestionsFailed ? ' area-failed' : ''}`}
            aria-label="Assistência da reunião"
            tabIndex={0}
          >
            {suggestionsFailed && (
              <p className="area-error" role="alert">
                <span aria-hidden="true">⚠</span> Falha nas sugestões.{' '}
                {attempt &&
                attempt.result !== 'pending' &&
                attempt.result !== 'success' &&
                attempt.result !== 'empty'
                  ? suggestionFailureMessages[attempt.result]
                  : suggestionFailureMessages.unavailable}{' '}
                Novas tentativas suspensas. Consulte Preferências e inicie uma
                nova sessão para tentar novamente.
              </p>
            )}
            {assistanceEnabled ? (
              <>
                <SuggestionCards
                  demo={false}
                  suggestions={suggestions.items}
                  busy={busy}
                  ratings={suggestions.feedback.ratings}
                  onOpenCitation={(id) => {
                    void command({
                      version: SESSION_IPC_VERSION,
                      action: 'open-citation',
                      id,
                    });
                  }}
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
                <StructuredMeetingResults snapshot={results} />
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
                <h2 className="pane-title">
                  <PanelIcon name="sparkles" />
                  Assistência
                </h2>
                <div className="pane-empty">
                  <span className="empty-icon">
                    <PanelIcon name="messageCircleDashed" />
                  </span>
                  <h3>Sugestões desativadas</h3>
                  <p>
                    {localActive
                      ? 'Para receber sugestões novamente, autorize o envio de texto à OpenAI no início de outra sessão.'
                      : 'Ao iniciar a sessão, você pode autorizar o envio de texto à OpenAI para receber sugestões.'}
                  </p>
                </div>
              </>
            )}
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
          </section>
        ) : null}
      </div>

      <div className="session-privacy">
        <PanelIcon name="lockKeyhole" />
        {!session ? (
          <p>
            {error || appError
              ? 'Não foi possível verificar a captura. Consulte Preferências.'
              : 'Verificando o estado da captura…'}
          </p>
        ) : localActive ? (
          <p role="status">
            Captura {session.phase === 'paused' ? 'pausada' : 'ativa'}
            {sources &&
              ` de ${sources.map((item) => sourceNames[item]).join(' e ')}`}
            . O áudio é processado neste Mac.
            {session.consent.context && (
              <strong> Envio de texto à OpenAI autorizado.</strong>
            )}
          </p>
        ) : (
          <p>
            Captura inativa. O áudio fica neste Mac e não é enviado à nuvem.
          </p>
        )}
      </div>

      {confirming && (
        <StartSessionDialog
          source={sourceNames[source]}
          hasSystemAudio={source !== 'mic'}
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
