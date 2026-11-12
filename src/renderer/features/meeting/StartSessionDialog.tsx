import { useEffect, useRef, useState } from 'react';
import { parseSuggestionAuthorization } from '../../../contracts/meeting/suggestionSession';
import type { SuggestionAuthorization } from '../../../contracts/meeting/suggestionSession';
import type { SettingsSnapshot } from '../../../contracts/ipc/settings';

type Props = {
  source: string;
  language: string;
  onCancel: () => void;
  onStart: (authorization?: SuggestionAuthorization) => void;
};

export function StartSessionDialog({
  source,
  language,
  onCancel,
  onStart,
}: Props) {
  const [withSuggestions, setWithSuggestions] = useState(false);
  const [model, setModel] = useState('');
  const [maxRequests, setMaxRequests] = useState(1);
  const [credential, setCredential] = useState<
    SettingsSnapshot['credential'] | null
  >(null);
  const [checking, setChecking] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const authorization = model.startsWith('sk-')
    ? null
    : parseSuggestionAuthorization({ model, maxRequests });
  const hasKey = credential === 'stored' || credential === 'development';
  const ready = hasKey && authorization !== null && !checking && !importing;

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve()
      .then(() => window.meetingCopilot.getSettings())
      .then((result) => {
        if (!mounted.current) return;
        if (result.ok) setCredential(result.settings.credential);
        else
          setError(
            'Não foi possível verificar a chave. Tente importar o arquivo novamente.',
          );
      })
      .catch(() => {
        if (mounted.current)
          setError(
            'Não foi possível verificar a chave. Você pode iniciar só a transcrição.',
          );
      })
      .finally(() => {
        if (mounted.current) setChecking(false);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  async function importKey() {
    setImporting(true);
    setError('');
    try {
      const result = await window.meetingCopilot.importSecret();
      if (!mounted.current) return;
      if (result.ok) setCredential(result.settings.credential);
      else
        setError(
          'Não foi possível importar. Escolha um arquivo de texto contendo somente a chave.',
        );
    } catch {
      if (mounted.current)
        setError('Não foi possível importar a chave. Tente novamente.');
    } finally {
      if (mounted.current) setImporting(false);
    }
  }

  return (
    <div className="consent-backdrop">
      <section
        aria-labelledby="consent-title"
        aria-describedby="local-start-description"
        aria-modal="true"
        className="consent-dialog"
        role="alertdialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !importing) {
            event.stopPropagation();
            onCancel();
          }
          if (event.key !== 'Tab') return;
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), summary, [tabindex="0"]',
            ),
          );
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="consent-content">
          <p className="eyebrow">PRONTO PARA COMEÇAR</p>
          <h3 id="consent-title">Transcrever neste Mac</h3>
          <dl className="capture-summary">
            <div>
              <dt>Capturar</dt>
              <dd>{source}</dd>
            </div>
            <div>
              <dt>Idioma</dt>
              <dd>{language}</dd>
            </div>
          </dl>
          <p id="local-start-description">
            A transcrição usa o áudio deste Mac. Não precisa de conta, chave ou
            créditos da OpenAI.
          </p>
          <p className="field-help">
            Ao iniciar, você permite a captura até pausar ou parar. O macOS pode
            pedir permissão para as fontes escolhidas.
          </p>
          <div className="suggestion-setup">
            <label className="suggestion-toggle">
              <input
                type="checkbox"
                checked={withSuggestions}
                onChange={(event) => setWithSuggestions(event.target.checked)}
                aria-controls="suggestion-setup-fields"
                aria-expanded={withSuggestions}
              />
              <span>
                Adicionar sugestões de IA
                <span className="optional-label">
                  Opcional · usa a API OpenAI
                </span>
              </span>
            </label>
            {withSuggestions && (
              <div
                id="suggestion-setup-fields"
                className="suggestion-setup-fields"
              >
                <p>
                  Receba perguntas e próximos passos a partir da conversa. Para
                  isso, o texto transcrito e um resumo são enviados à OpenAI. O
                  áudio fica no Mac.
                </p>
                <div className="credential-setup">
                  <strong>Chave da API OpenAI</strong>
                  <p className="credential-status" role="status">
                    {checking
                      ? 'Verificando configuração…'
                      : hasKey
                        ? 'Chave configurada'
                        : 'Chave ainda não configurada'}
                  </p>
                  {!hasKey && (
                    <>
                      <p className="field-help">
                        Importe um arquivo de texto contendo sua chave. Ela fica
                        protegida no Mac e não é exibida aqui.
                      </p>
                      <button
                        disabled={checking || importing}
                        onClick={() => {
                          void importKey();
                        }}
                      >
                        {importing
                          ? 'Importando…'
                          : 'Importar arquivo com a chave'}
                      </button>
                    </>
                  )}
                  {hasKey && (
                    <p className="field-help">
                      Você pode gerenciar a chave em Preferências → Chave
                      OpenAI.
                    </p>
                  )}
                  {error && <p role="alert">{error}</p>}
                </div>
                <label htmlFor="suggestion-model">
                  Modelo para as sugestões
                </label>
                <input
                  id="suggestion-model"
                  value={model}
                  maxLength={200}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Nome do modelo na sua conta da API"
                  aria-describedby="suggestion-model-help"
                  onChange={(event) => setModel(event.target.value.trim())}
                />
                <p id="suggestion-model-help" className="field-help">
                  É o nome do modelo de IA disponível na sua conta OpenAI. Este
                  campo não é a chave da API.
                </p>
                {model.startsWith('sk-') && (
                  <p role="alert">
                    Isso parece uma chave. Use a importação acima; aqui deve
                    entrar apenas o nome do modelo.
                  </p>
                )}
                <label htmlFor="suggestion-limit">
                  Limite de pedidos de sugestão
                </label>
                <input
                  id="suggestion-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={maxRequests}
                  aria-describedby="suggestion-limit-help"
                  onChange={(event) =>
                    setMaxRequests(Number(event.target.value))
                  }
                />
                <p id="suggestion-limit-help" className="field-help">
                  De 1 a 100 nesta sessão. Cada pedido pode gerar até dois
                  cartões. Falhas também contam.
                </p>
                <p className="cloud-consent">
                  Ao iniciar com sugestões, você autoriza o envio de texto à
                  OpenAI e o custo da API. O limite acima conta pedidos, não
                  dinheiro. Confira o preço do modelo na sua conta.
                </p>
                <p className="field-help">
                  Você pode desativar as sugestões durante a sessão. Disponíveis
                  em português (Brasil).
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="consent-actions">
          {withSuggestions && !ready && (
            <p className="field-help" role="status">
              {!hasKey
                ? 'Configure a chave e o modelo para usar sugestões.'
                : !authorization
                  ? 'Preencha o nome do modelo e um limite de 1 a 100.'
                  : 'Aguarde a configuração da chave.'}{' '}
              A transcrição local já pode começar.
            </p>
          )}
          <button
            className="primary-action"
            disabled={withSuggestions && !ready}
            onClick={() =>
              onStart(
                withSuggestions && authorization ? authorization : undefined,
              )
            }
          >
            {withSuggestions ? 'Iniciar com sugestões' : 'Iniciar transcrição'}
          </button>
          {withSuggestions && (
            <button onClick={() => onStart()}>
              Iniciar apenas a transcrição
            </button>
          )}
          <button autoFocus onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}
