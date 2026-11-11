import { SuggestionCards } from '../suggestions/SuggestionCards';
import { parseSuggestionAuthorization } from '../../../contracts/meeting/suggestionSession';
import { LocalTranscriptPreview } from './LocalTranscriptPreview';
import { useState } from 'react';
import type {
  AudioSource,
  TranscriptionLocale,
} from '../../../contracts/native/protocol';
import { useMeetingSession } from './useMeetingSession';
import { DemoPreview } from './DemoPreview';

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

export function SessionControls() {
  const {
    session,
    demo,
    local,
    suggestions,
    busy,
    error,
    preferences,
    command,
  } = useMeetingSession();
  const [localeOverride, setLocaleOverride] =
    useState<TranscriptionLocale | null>(null);
  const locale: TranscriptionLocale =
    localeOverride ?? (preferences?.language === 'en-US' ? 'en-US' : 'pt-BR');
  const [source, setSource] = useState<SourceChoice>('both');
  const [confirming, setConfirming] = useState(false);
  const [allowSuggestions, setAllowSuggestions] = useState(false);
  const [model, setModel] = useState('');
  const [maxRequests, setMaxRequests] = useState(1);
  const authorization = parseSuggestionAuthorization({ model, maxRequests });
  const canStart = session?.phase === 'idle' || session?.phase === 'stopped';
  const localActive = session?.mode === 'apple-local' && !canStart;

  function startLocal(): void {
    if (!canStart || busy) return;
    setAllowSuggestions(false);
    setConfirming(true);
  }

  function confirmLocalConsent(): void {
    if (allowSuggestions && !authorization) return;
    setConfirming(false);
    void command({
      version: 4,
      action: 'start',
      options: {
        mode: 'apple-local',
        consent: {
          capture: true,
          context: allowSuggestions,
          remoteAudio: false,
        },
        ...(allowSuggestions && authorization
          ? { suggestions: authorization }
          : {}),
        locale,
        sources: selectedSources(source),
      },
    });
  }

  function startDemo(): void {
    void command({
      version: 4,
      action: 'start',
      options: {
        mode: 'demo',
        consent: { capture: false, context: false, remoteAudio: false },
      },
    });
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
          <label>
            Idioma
            <select
              value={locale}
              onChange={(event) =>
                setLocaleOverride(event.target.value as TranscriptionLocale)
              }
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
            </select>
          </label>
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
              void command({ version: 4, action: 'pause' });
            }}
          >
            Pausar
          </button>
        )}
        {session?.phase === 'paused' && (
          <button
            disabled={busy}
            onClick={() => {
              void command({ version: 4, action: 'resume' });
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
              void command({ version: 4, action: 'stop' });
            }}
          >
            Parar
          </button>
        )}
      </div>

      {session?.mode === 'apple-local' && (
        <LocalTranscriptPreview transcript={local} />
      )}

      {localActive && suggestions.status !== 'disabled' && (
        <>
          <p role="status">
            Sugestões OpenAI: {suggestions.remainingRequests} chamadas restantes
            nesta sessão.
            {suggestions.status === 'exhausted' &&
              ' Limite atingido. A transcrição local continua.'}
            {suggestions.status === 'unavailable' &&
              ' Não foi possível obter sugestões. Confira a chave e o modelo antes de uma nova sessão.'}
          </p>
          <button
            disabled={busy}
            onClick={() => {
              void command({ version: 4, action: 'revoke-suggestions' });
            }}
          >
            Desativar sugestões
          </button>
          <SuggestionCards
            demo={false}
            suggestions={suggestions.items}
            busy={busy}
            onDismiss={(id) => {
              void command({ version: 4, action: 'dismiss-suggestion', id });
            }}
          />
        </>
      )}

      <details
        className="secondary-mode"
        open={session?.mode === 'demo' && session.phase !== 'idle'}
      >
        <summary>Testar a demonstração</summary>
        <p>
          A DEMO usa falas simuladas. Não acessa o microfone, não captura áudio
          do sistema e não transcreve a reunião.
        </p>
        <button disabled={busy || !canStart} onClick={startDemo}>
          Iniciar DEMO
        </button>
        {session?.mode === 'demo' && (
          <DemoPreview
            demo={demo}
            phase={session.phase}
            busy={busy}
            onDismiss={(id) => {
              void command({ version: 4, action: 'dismiss-suggestion', id });
            }}
          />
        )}
      </details>

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
          enviado no modo local. A DEMO é apenas uma simulação.
        </p>
      </details>

      {confirming && (
        <div className="consent-backdrop">
          <section
            aria-labelledby="consent-title"
            aria-modal="true"
            className="consent-dialog"
            role="alertdialog"
          >
            <h3 id="consent-title">Iniciar transcrição local?</h3>
            <p>
              O Meeting Copilot capturará {sourceNames[source]} em{' '}
              {locale === 'pt-BR' ? 'português (Brasil)' : 'inglês (EUA)'}. O
              processamento será local e durará até você parar a sessão.
            </p>
            <p>
              Esta confirmação autoriza o app. Permissões do macOS são
              solicitadas separadamente e ainda precisam ser concedidas por
              você.
            </p>
            <label>
              <input
                type="checkbox"
                checked={allowSuggestions}
                onChange={(event) => setAllowSuggestions(event.target.checked)}
              />
              Autorizar envio de texto e custos de sugestões OpenAI nesta sessão
            </label>
            {allowSuggestions && (
              <fieldset>
                <p>
                  Falas finais e resumo limitado serão enviados a api.openai.com
                  para sugestões. Nenhum áudio ou imagem será enviado. A API é
                  cobrada separadamente. Confirme preço, acesso ao modelo e
                  saldo antes de autorizar. O limite abaixo conta tentativas,
                  inclusive falhas; não é um teto em reais.
                </p>
                <label>
                  Modelo OpenAI confirmado
                  <input
                    value={model}
                    maxLength={200}
                    onChange={(event) => setModel(event.target.value)}
                  />
                </label>
                <label>
                  Máximo de chamadas nesta sessão
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxRequests}
                    onChange={(event) =>
                      setMaxRequests(Number(event.target.value))
                    }
                  />
                </label>
                <p>
                  Até 2.048 tokens de saída por chamada. Pause, pare ou desative
                  sugestões para cancelar novos envios. Isso não desfaz envios
                  já realizados. Gatilhos automáticos disponíveis em pt-BR.
                </p>
              </fieldset>
            )}
            <div className="session-actions">
              <button autoFocus onClick={() => setConfirming(false)}>
                Cancelar
              </button>
              <button
                className="primary-action"
                disabled={allowSuggestions && !authorization}
                onClick={confirmLocalConsent}
              >
                Autorizar e iniciar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
