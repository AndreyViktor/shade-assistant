import {
  SUGGESTION_MODELS,
  SUGGESTION_PROVIDERS,
  TRANSCRIPTION_PROVIDERS,
} from '../../../contracts/settings/providerOptions';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { parsePreferences } from '../../../contracts/settings/preferences';
import type { Preferences } from '../../../contracts/settings/preferences';
import type {
  SettingsResult,
  SettingsSnapshot,
} from '../../../contracts/ipc/settings';
import { ShortcutsPanel } from './ShortcutsPanel';
import { ReadinessPanel } from './ReadinessPanel';

type Area = 'audio' | 'suggestions' | 'readiness' | 'diagnostics' | 'shortcuts';

export function SettingsPanel({
  active = true,
  onSaved,
  connection,
  diagnostics,
  sessionSummary = 'Sessão indisponível',
  demoSummary = 'DEMO offline disponível',
  onClose,
}: {
  active?: boolean;
  connection?: ReactNode;
  diagnostics?: ReactNode;
  sessionSummary?: string;
  demoSummary?: string;
  onClose?: () => void;
  onSaved?: ((preferences: Preferences) => void) | undefined;
}) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [area, setArea] = useState<Area | null>(null);
  const [readinessSummary, setReadinessSummary] = useState('Não verificado');
  const [confirm, setConfirm] = useState<'area' | 'panel' | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const origin = useRef<Area | null>(null);
  const root = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const dirty =
    !!snapshot &&
    !!draft &&
    JSON.stringify(draft) !== JSON.stringify(snapshot.preferences);

  useEffect(() => {
    if (!active) return;
    let current = true;
    async function load() {
      setLoading(true);
      setMessage('Carregando preferências…');
      try {
        const result = await window.meetingCopilot.getSettings();
        if (!current) return;
        if (!result.ok) throw new Error('UNAVAILABLE');
        setSnapshot(result.settings);
        setDraft(result.settings.preferences);
        setMessage('');
      } catch {
        if (current)
          setMessage(
            'Não foi possível carregar as preferências. Tente novamente.',
          );
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [active, loadAttempt]);

  useEffect(() => {
    if (active) back.current?.focus();
  }, [active]);
  useEffect(() => {
    if (confirm) keep.current?.focus();
  }, [confirm]);

  function requestBack(destination: 'area' | 'panel') {
    if (busy) return;
    if (dirty) {
      opener.current = document.activeElement as HTMLElement;
      setConfirm(destination);
    } else navigateBack(destination);
  }
  function navigateBack(destination: 'area' | 'panel') {
    if (destination === 'panel') {
      setMessage('');
      setArea(null);
      onClose?.();
    } else {
      setArea(null);
      requestAnimationFrame(() =>
        root.current
          ?.querySelector<HTMLButtonElement>(
            `[data-settings-area="${origin.current}"]`,
          )
          ?.focus(),
      );
    }
  }
  useEffect(() => {
    if (!active) return;
    function keydown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      if (confirm) {
        setConfirm(null);
        opener.current?.focus();
      } else requestBack(area ? 'area' : 'panel');
    }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });

  async function perform(
    action: () => Promise<SettingsResult>,
    saveDraft = false,
  ) {
    setBusy(true);
    setMessage(
      saveDraft ? 'Salvando preferências…' : 'Atualizando estado da chave…',
    );
    try {
      const result = await action();
      if (!result.ok) throw new Error('UNAVAILABLE');
      setSnapshot(result.settings);
      if (saveDraft) setDraft(result.settings.preferences);
      onSaved?.(result.settings.preferences);
      setMessage(
        'Preferências e estado da chave atualizados. Nenhum serviço foi iniciado.',
      );
    } catch {
      setMessage('Não foi possível concluir. Confira e tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  function change(field: keyof Preferences, value: string) {
    const parsed = parsePreferences({ ...draft, [field]: value });
    if (parsed) setDraft(parsed);
  }
  function openArea(next: Area) {
    origin.current = next;
    setArea(next);
    setMessage('');
    requestAnimationFrame(() => back.current?.focus());
  }
  const saved = snapshot?.preferences;
  const source = !saved
    ? 'Indisponível'
    : saved.audioSource === 'both'
      ? 'Microfone + sistema'
      : saved?.audioSource === 'mic'
        ? 'Microfone'
        : 'Áudio do sistema';
  const credential =
    snapshot?.credential === 'stored'
      ? 'Chave no cofre do Mac'
      : snapshot?.credential === 'development'
        ? 'Chave de desenvolvimento'
        : snapshot
          ? 'Chave não configurada'
          : 'Estado da chave indisponível';
  const items: {
    id: Area;
    title: string;
    description: string;
    summary: string;
    detail: string;
    icon: string;
  }[] = [
    {
      id: 'audio',
      title: 'Áudio e transcrição',
      description: 'Fonte, idioma e fornecedor',
      summary:
        TRANSCRIPTION_PROVIDERS.find(
          (p) => p.id === saved?.sttProvider,
        )?.label.split(' — ')[0] ?? 'Indisponível',
      detail: `${source} · ${saved?.language ?? '—'}`,
      icon: '◉',
    },
    {
      id: 'suggestions',
      title: 'Sugestões de IA',
      description: 'Fornecedor, modelo e chave',
      summary: `${SUGGESTION_PROVIDERS.find((p) => p.id === saved?.suggestionProvider)?.label.split(' — ')[0] ?? 'Indisponível'} · ${SUGGESTION_MODELS.find((m) => m.id === saved?.suggestionModel)?.label.split(' — ')[0] ?? '—'}`,
      detail: credential,
      icon: '✦',
    },
    {
      id: 'shortcuts',
      title: 'Atalhos globais',
      description: 'Combinações para janela e sessão',
      summary: 'Configurar',
      detail: 'Atalhos de teclado',
      icon: '⌘',
    },
    {
      id: 'readiness',
      title: 'Permissões e prontidão',
      description: 'Verificação no macOS',
      summary: readinessSummary,
      detail: 'Consultar antes da reunião',
      icon: '◇',
    },
    {
      id: 'diagnostics',
      title: 'Diagnóstico',
      description: 'Estado da sessão e demonstração offline',
      summary: sessionSummary,
      detail: demoSummary,
      icon: '▣',
    },
  ];
  return (
    <section ref={root} className="settings" aria-labelledby="settings-title">
      <button
        ref={back}
        type="button"
        className="settings-back"
        onClick={() => requestBack(area ? 'area' : 'panel')}
      >
        {area ? 'Voltar às preferências' : 'Voltar ao painel'}
      </button>
      <h2 id="settings-title">
        {area ? items.find((item) => item.id === area)?.title : 'Preferências'}
      </h2>
      <p>
        As escolhas de áudio e sugestões valem para a próxima sessão. Atalhos
        são aplicados ao confirmar. Salvar não autoriza captura, envio ou
        cobrança.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!loading && !snapshot && (
        <button type="button" onClick={() => setLoadAttempt((n) => n + 1)}>
          Tentar novamente
        </button>
      )}
      {!loading && !area && (
        <>
          <div className="settings-areas">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                data-settings-area={item.id}
                className="settings-area"
                disabled={
                  (!snapshot || !draft) &&
                  (item.id === 'audio' || item.id === 'suggestions')
                }
                onClick={() => openArea(item.id)}
              >
                <span className="settings-area-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="settings-area-name">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
                <span className="settings-area-summary">
                  <span>{item.summary}</span>
                  <small>{item.detail}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          <p>A transcrição local mantém o áudio neste Mac.</p>
        </>
      )}
      {draft && snapshot && (
        <form
          hidden={area !== 'audio' && area !== 'suggestions'}
          onSubmit={(event) => {
            event.preventDefault();
            if (dirty)
              void perform(
                () => window.meetingCopilot.savePreferences(draft),
                true,
              );
          }}
        >
          <div hidden={area !== 'audio'}>
            <fieldset disabled={busy}>
              <legend>Transcrição de áudio</legend>
              <label>
                Fonte de áudio
                <select
                  value={draft.audioSource}
                  onChange={(event) =>
                    change('audioSource', event.target.value)
                  }
                >
                  <option value="both">Ambas as fontes</option>
                  <option value="mic">Microfone</option>
                  <option value="system">Áudio do sistema</option>
                </select>
              </label>
              <label>
                Fornecedor de transcrição
                <select
                  value={draft.sttProvider}
                  onChange={(event) =>
                    change('sttProvider', event.target.value)
                  }
                >
                  {TRANSCRIPTION_PROVIDERS.map((provider) => (
                    <option
                      key={provider.id}
                      value={provider.id}
                      disabled={!provider.available}
                    >
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Apple Local requer macOS, permissões e idioma instalado. OpenAI
                STT não está disponível nesta versão.
              </p>
              <label>
                Idioma
                <select
                  value={draft.language}
                  onChange={(event) => change('language', event.target.value)}
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">Inglês (EUA)</option>
                </select>
              </label>
            </fieldset>
          </div>
          <div hidden={area !== 'suggestions'}>
            <fieldset disabled={busy}>
              <legend>Sugestões de IA</legend>
              <label>
                Fornecedor de sugestões
                <select
                  value={draft.suggestionProvider}
                  onChange={(event) =>
                    change('suggestionProvider', event.target.value)
                  }
                >
                  {SUGGESTION_PROVIDERS.map((provider) => (
                    <option
                      key={provider.id}
                      value={provider.id}
                      disabled={!provider.available}
                    >
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Modelo para as sugestões
                <select
                  value={draft.suggestionModel}
                  onChange={(event) =>
                    change('suggestionModel', event.target.value)
                  }
                  aria-describedby="model-help"
                >
                  {SUGGESTION_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
              <p id="model-help">
                {
                  SUGGESTION_MODELS.find(
                    (model) => model.id === draft.suggestionModel,
                  )?.description
                }{' '}
                O acesso depende da sua conta da API OpenAI.
              </p>
              <p>
                Captura, envio de texto e limite de pedidos são confirmados a
                cada sessão. Salvar não autoriza cobranças.
              </p>
              <details className="advanced-settings">
                <summary>Chave OpenAI (não usada na transcrição local)</summary>
                <p>
                  Estado:{' '}
                  {snapshot.credential === 'stored'
                    ? 'armazenada no cofre do Mac'
                    : snapshot.credential === 'development'
                      ? 'carregada de .env ou OPENAI_API_KEY no desenvolvimento'
                      : 'não configurada'}
                </p>
                <p>
                  Esta chave permite gerar sugestões de IA quando você ativar
                  essa opção ao iniciar uma sessão. A transcrição local funciona
                  sem ela.
                </p>
                {snapshot.credential !== 'development' && (
                  <p>
                    Importe um arquivo de texto contendo somente sua chave da
                    API OpenAI. O app a guarda protegida no Mac e nunca a exibe.
                    Importar a chave não inicia envios nem cobranças.
                  </p>
                )}
                <div className="settings-actions">
                  <button
                    type="button"
                    disabled={busy || snapshot.credential === 'development'}
                    onClick={() => {
                      void perform(() => window.meetingCopilot.importSecret());
                    }}
                  >
                    Importar chave
                  </button>
                  <button
                    type="button"
                    disabled={busy || snapshot.credential !== 'stored'}
                    onClick={() => {
                      void perform(() => window.meetingCopilot.removeSecret());
                    }}
                  >
                    Remover chave
                  </button>
                </div>
                {snapshot.credential === 'development' && (
                  <p>
                    Para remover a chave de desenvolvimento, encerre o app e
                    retire OPENAI_API_KEY do arquivo .env e do ambiente.
                    Reinicie o app após alterar a chave.
                  </p>
                )}
              </details>
            </fieldset>
          </div>
          <div className="settings-actions">
            <span role="status">
              {dirty ? 'Alterações pendentes' : 'Nenhuma alteração pendente'}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => requestBack('area')}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-action"
              disabled={busy || !dirty}
            >
              Salvar preferências
            </button>
          </div>
        </form>
      )}
      {area === 'shortcuts' && <ShortcutsPanel />}
      <div hidden={area !== 'readiness'}>
        <section aria-labelledby="privacy-title">
          <h3 id="privacy-title">Permissões e privacidade</h3>
          <p>
            A captura da fonte selecionada exige confirmação ao iniciar cada
            sessão. O macOS também controla as permissões de microfone e
            gravação de tela/áudio do sistema. Confirme que os demais
            participantes autorizaram a transcrição.
          </p>
          <p>
            O envio de texto à OpenAI exige autorização separada a cada sessão.
            As falas recentes ficam em memória e são limpas ao parar. Áudio
            nunca é enviado no modo local.
          </p>
          <ReadinessPanel onSummaryChange={setReadinessSummary} />
        </section>
      </div>
      <section hidden={area !== 'diagnostics'} aria-label="Diagnóstico">
        {connection}
        {diagnostics}
      </section>
      {confirm && (
        <div className="settings-confirm-backdrop">
          <div
            className="settings-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                const buttons =
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    'button',
                  );
                if (event.shiftKey && document.activeElement === buttons[0]) {
                  event.preventDefault();
                  buttons[buttons.length - 1]?.focus();
                } else if (
                  !event.shiftKey &&
                  document.activeElement === buttons[buttons.length - 1]
                ) {
                  event.preventDefault();
                  buttons[0]?.focus();
                }
              }
            }}
          >
            <h3 id="discard-title">Descartar alterações?</h3>
            <p>As alterações pendentes não foram salvas.</p>
            <div className="settings-actions">
              <button
                ref={keep}
                type="button"
                onClick={() => {
                  setConfirm(null);
                  opener.current?.focus();
                }}
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={() => {
                  if (snapshot) setDraft(snapshot.preferences);
                  const destination = confirm;
                  setConfirm(null);
                  navigateBack(destination);
                }}
              >
                Descartar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
