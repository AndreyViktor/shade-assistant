import type { Preferences } from '../../../contracts/settings/preferences';
import { SuggestionCards } from '../suggestions/SuggestionCards';
import { SuggestionDiagnosticsPanel } from '../suggestions/SuggestionDiagnosticsPanel';
import { StartSessionDialog } from './StartSessionDialog';
import type { SuggestionAuthorization } from '../../../contracts/meeting/suggestionSession';
import { LocalTranscriptPreview } from './LocalTranscriptPreview';
import { useRef, useState } from 'react';
import type {
  AudioSource,
  TranscriptionLocale,
} from '../../../contracts/native/protocol';
import type { useMeetingSession } from './useMeetingSession';

type SourceChoice = 'mic' | 'system' | 'both';

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
}: {
  meeting: ReturnType<typeof useMeetingSession>;
  savedPreferences?: Preferences | null;
}) {
  const { session, local, suggestions, busy, error, preferences, command } =
    meeting;
  const locale: TranscriptionLocale =
    (savedPreferences ?? preferences)?.language === 'en-US' ? 'en-US' : 'pt-BR';
  const [source, setSource] = useState<SourceChoice>('both');
  const [confirming, setConfirming] = useState(false);
  const startButton = useRef<HTMLButtonElement>(null);
  const canStart = session?.phase === 'idle' || session?.phase === 'stopped';
  const localActive = session?.mode === 'apple-local' && !canStart;

  function startLocal(): void {
    if (!canStart || busy) return;
    setConfirming(true);
  }

  function confirmLocalConsent(authorization?: SuggestionAuthorization): void {
    setConfirming(false);
    void command({
      version: 6,
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

  if (session?.mode === 'demo' && !canStart) {
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
            void command({ version: 6, action: 'stop' });
          }}
        >
          Parar DEMO
        </button>
      </section>
    );
  }

  return (
    <section className="session-controls" aria-labelledby="session-title">
      <div className="session-heading">
        <h2 id="session-title">Transcrição</h2>
        <p role="status">
          {session ? phaseLabels[session.phase] : 'Verificando…'}
        </p>
      </div>

      {!localActive && (
        <fieldset className="capture-options" disabled={busy || !canStart}>
          <label>
            Fonte de áudio
            <select
              value={source}
              onChange={(event) =>
                setSource(event.target.value as SourceChoice)
              }
            >
              <option value="both">Ambas as fontes</option>
              <option value="mic">Microfone</option>
              <option value="system">Áudio do sistema</option>
            </select>
          </label>
          <p>
            Idioma: {locale === 'pt-BR' ? 'Português (Brasil)' : 'Inglês (EUA)'}
            . Altere em Preferências.
          </p>
        </fieldset>
      )}

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

      {error && <p role="alert">{error}</p>}

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
              void command({ version: 6, action: 'pause' });
            }}
          >
            Pausar
          </button>
        )}
        {session?.phase === 'paused' && (
          <button
            disabled={busy}
            onClick={() => {
              void command({ version: 6, action: 'resume' });
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
              void command({ version: 6, action: 'stop' });
            }}
          >
            Parar
          </button>
        )}
      </div>

      {session?.mode === 'apple-local' && (localActive || local) && (
        <div className="meeting-workspace">
          {local ? (
            <LocalTranscriptPreview transcript={local} />
          ) : (
            <section
              className="local-transcript"
              aria-label="Transcrição ao vivo"
            >
              <h3>Transcrição ao vivo</h3>
              <p role="status">Aguardando transcrição local…</p>
            </section>
          )}
          <section
            className="meeting-assistance"
            aria-label="Assistência da reunião"
            tabIndex={0}
          >
            {localActive && suggestions.status !== 'disabled' ? (
              <>
                <SuggestionCards
                  demo={false}
                  suggestions={suggestions.items}
                  busy={busy}
                  onDismiss={(id) => {
                    void command({
                      version: 6,
                      action: 'dismiss-suggestion',
                      id,
                    });
                  }}
                />
                <p role="status">
                  Sugestões OpenAI: {suggestions.remainingRequests} chamadas
                  restantes nesta sessão.
                </p>
                <button
                  disabled={busy}
                  onClick={() => {
                    void command({ version: 6, action: 'revoke-suggestions' });
                  }}
                >
                  Desativar sugestões
                </button>
              </>
            ) : (
              <>
                <h3>Sugestões</h3>
                <p>
                  Sugestões desativadas. A transcrição continua disponível neste
                  painel.
                </p>
              </>
            )}
            {localActive && (
              <SuggestionDiagnosticsPanel snapshot={suggestions} />
            )}
          </section>
        </div>
      )}

      <details className="privacy-details">
        <summary>Permissões e privacidade</summary>
        <p>
          Ao continuar, você autoriza a captura da fonte selecionada somente
          durante esta sessão. O macOS também controla as permissões de
          microfone e gravação de tela/áudio do sistema. Confirme que os demais
          participantes autorizaram a transcrição.
        </p>
        <p>
          O envio de texto à OpenAI exige autorização separada a cada sessão. As
          falas recentes ficam em memória e são limpas ao parar. Áudio nunca é
          enviado no modo local.
        </p>
      </details>

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
