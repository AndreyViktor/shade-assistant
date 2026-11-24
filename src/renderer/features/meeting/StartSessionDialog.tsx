import {
  DEFAULT_SUGGESTION_MODEL,
  SUGGESTION_MODELS,
} from '../../../contracts/settings/providerOptions';
import { useEffect, useRef, useState } from 'react';
import {
  parseSuggestionAuthorization,
  USER_CONTEXT_LIMIT,
} from '../../../contracts/meeting/suggestionSession';
import type { SuggestionAuthorization } from '../../../contracts/meeting/suggestionSession';
import type { SettingsSnapshot } from '../../../contracts/ipc/settings';
import {
  MEETING_PROFILES,
  type MeetingProfileId,
} from '../../../contracts/meeting/meetingProfile';

type Props = {
  source: string;
  hasSystemAudio?: boolean;
  language: string;
  onCancel: () => void;
  onStart: (authorization?: SuggestionAuthorization) => void;
};

export function StartSessionDialog({
  source,
  hasSystemAudio = true,
  language,
  onCancel,
  onStart,
}: Props) {
  const [withSuggestions, setWithSuggestions] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_SUGGESTION_MODEL);
  const [maxRequests, setMaxRequests] = useState(10);
  const [userContext, setUserContext] = useState('');
  const [meetingProfile, setMeetingProfile] =
    useState<MeetingProfileId>('none');
  const [webSearchConsent, setWebSearchConsent] = useState(false);
  const [credential, setCredential] = useState<
    SettingsSnapshot['credential'] | null
  >(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const selectedModel = SUGGESTION_MODELS.find((option) => option.id === model);
  const authorization = selectedModel
    ? parseSuggestionAuthorization({
        model: selectedModel.id,
        maxRequests,
        userContext,
        ...(meetingProfile === 'none' ? {} : { meetingProfile }),
        ...(meetingProfile === 'video-fact-check' && webSearchConsent
          ? { webSearchConsent: true }
          : {}),
      })
    : null;
  const hasKey = credential === 'stored' || credential === 'development';
  const ready =
    hasKey &&
    authorization !== null &&
    !checking &&
    (meetingProfile !== 'video-fact-check' || hasSystemAudio);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve()
      .then(() => window.meetingCopilot.getSettings())
      .then((result) => {
        if (!mounted.current) return;
        if (result.ok) {
          setCredential(result.settings.credential);
          setModel(result.settings.preferences.suggestionModel);
        } else
          setError(
            'Não foi possível verificar a chave. Confira as Preferências.',
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

  return (
    <div className="consent-backdrop">
      <section
        aria-labelledby="consent-title"
        aria-describedby="local-start-description"
        aria-modal="true"
        className="consent-dialog"
        role="alertdialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
          if (event.key !== 'Tab') return;
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
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
                onChange={(event) => {
                  setWithSuggestions(event.target.checked);
                  if (!event.target.checked) {
                    setUserContext('');
                    setMeetingProfile('none');
                    setWebSearchConsent(false);
                  }
                }}
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
                  Receba perguntas, próximos passos e resultados estruturados a
                  partir da conversa. Para isso, trechos finais, um resumo e os
                  resultados atuais são enviados periodicamente à OpenAI junto
                  do contexto opcional, com intervalo mínimo de 10 segundos. O
                  áudio fica no Mac.
                </p>
                <fieldset
                  className="profile-options"
                  aria-describedby="meeting-profile-session-help"
                >
                  <legend>Foco do assistente</legend>
                  <p id="meeting-profile-session-help" className="field-help">
                    O foco prioriza sugestões nesta sessão; não comprova o que
                    foi dito nem autoriza captura, envio ou custo.
                  </p>
                  <label className="profile-option">
                    <input
                      type="radio"
                      name="meeting-profile"
                      value="none"
                      checked={meetingProfile === 'none'}
                      onChange={() => setMeetingProfile('none')}
                    />
                    <span>
                      <strong>Sem perfil</strong>
                      <br />A IA infere a ajuda útil pela conversa e pelo
                      contexto opcional.
                    </span>
                  </label>
                  {MEETING_PROFILES.map((profile) => (
                    <label key={profile.id} className="profile-option">
                      <input
                        type="radio"
                        name="meeting-profile"
                        value={profile.id}
                        checked={meetingProfile === profile.id}
                        onChange={() => setMeetingProfile(profile.id)}
                      />
                      <span>
                        <strong>{profile.label}</strong>
                        <br />
                        {profile.objective}
                      </span>
                    </label>
                  ))}
                </fieldset>
                {meetingProfile === 'video-fact-check' && (
                  <>
                    {!hasSystemAudio && (
                      <p role="alert">
                        Selecione áudio do sistema nas Preferências para
                        verificar vídeos.
                      </p>
                    )}
                    <label className="suggestion-toggle">
                      <input
                        type="checkbox"
                        checked={webSearchConsent}
                        onChange={(event) =>
                          setWebSearchConsent(event.target.checked)
                        }
                      />
                      <span>
                        Autorizo consultas na web pela OpenAI para verificar
                        afirmações. Consultas podem conter informações da
                        transcrição ou do contexto e gerar custos adicionais de
                        busca, além dos tokens. O limite abaixo conta pedidos,
                        não o valor gasto nem buscas individuais.
                      </span>
                    </label>
                  </>
                )}
                <label htmlFor="suggestion-context">
                  Contexto da reunião (opcional)
                </label>
                <textarea
                  id="suggestion-context"
                  rows={3}
                  maxLength={USER_CONTEXT_LIMIT}
                  value={userContext}
                  aria-describedby="suggestion-context-help"
                  placeholder="Ex.: revisão do projeto Aurora; quero esclarecer riscos; participo como designer."
                  onChange={(event) => setUserContext(event.target.value)}
                />
                <p id="suggestion-context-help" className="field-help">
                  {userContext.length}/{USER_CONTEXT_LIMIT} caracteres. Informe
                  tema, objetivo ou seu papel. Sem preencher, a IA infere o que
                  é útil pela conversa e pode não gerar cartões. O contexto é
                  enviado separado da transcrição em cada pedido autorizado.
                  Fica só em memória, inclusive no diagnóstico do último pedido;
                  é apagado ao encerrar ou desativar sugestões e não é salvo
                  para outra sessão.
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
                    <p className="field-help">
                      Configure a chave em Preferências → Chave OpenAI e volte
                      para iniciar. A transcrição local funciona sem chave.
                    </p>
                  )}
                  {hasKey && (
                    <p className="field-help">
                      {credential === 'development'
                        ? 'Chave carregada de .env ou OPENAI_API_KEY. Reinicie o app após alterá-la.'
                        : 'Você pode gerenciar a chave em Preferências → Chave OpenAI.'}
                    </p>
                  )}
                  {error && <p role="alert">{error}</p>}
                </div>
                <p>
                  Modelo para as sugestões:{' '}
                  <strong>{selectedModel?.label}</strong>
                </p>
                <p className="field-help">
                  Altere o modelo em Preferências. O acesso depende da sua conta
                  da API OpenAI.
                </p>
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
                  De 1 a 100 nesta sessão. Cada pedido pode gerar até oito
                  sugestões. Falhas também contam.
                </p>
                <p className="cloud-consent">
                  Ao iniciar com sugestões, você autoriza o envio da transcrição
                  e do contexto opcional à OpenAI e o custo da API. O limite
                  acima conta pedidos, não dinheiro. Confira o preço do modelo
                  na sua conta.
                </p>
                <p className="field-help">
                  Você pode desativar as sugestões e os resultados ao vivo
                  durante a sessão; ambos ficam somente em memória.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="consent-actions">
          {withSuggestions && !ready && (
            <p className="field-help" role="status">
              {!hasKey
                ? 'Configure a chave para usar sugestões.'
                : !authorization
                  ? 'Confira o limite, o contexto e a autorização de busca para vídeos.'
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
