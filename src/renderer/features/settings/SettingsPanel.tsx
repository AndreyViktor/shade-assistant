import {
  SUGGESTION_MODELS,
  SUGGESTION_PROVIDERS,
  TRANSCRIPTION_PROVIDERS,
} from '../../../contracts/settings/providerOptions';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { parsePreferences } from '../../../contracts/settings/preferences';
import type { Preferences } from '../../../contracts/settings/preferences';
import type {
  SettingsResult,
  SettingsSnapshot,
} from '../../../contracts/ipc/settings';

export function SettingsPanel({
  active = true,
  onSaved,
  connection,
}: {
  active?: boolean;
  connection?: ReactNode;
  onSaved?: ((preferences: Preferences) => void) | undefined;
}) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!active) return;
    let current = true;
    async function load() {
      try {
        const result = await window.meetingCopilot.getSettings();
        if (!current) return;
        if (!result.ok) throw new Error('UNAVAILABLE');
        setSnapshot(result.settings);
        setDraft((previous) => previous ?? result.settings.preferences);
      } catch {
        if (current)
          setMessage(
            'Não foi possível carregar as preferências. Reabra o app.',
          );
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [active]);

  async function perform(
    action: () => Promise<SettingsResult>,
    saveDraft = false,
  ) {
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      if (!result.ok) {
        setMessage(
          'Não foi possível concluir. Reabra o app para conferir o estado salvo.',
        );
        return;
      }
      setSnapshot(result.settings);
      if (saveDraft) setDraft(result.settings.preferences);
      onSaved?.(result.settings.preferences);
      setMessage(
        'Preferências e estado da chave atualizados. Nenhum serviço foi iniciado.',
      );
    } catch {
      setMessage(
        'Não foi possível concluir. Reabra o app para conferir o estado salvo.',
      );
    } finally {
      setBusy(false);
    }
  }

  function change(field: keyof Preferences, value: string) {
    const parsed = parsePreferences({ ...draft, [field]: value });
    if (parsed) setDraft(parsed);
  }

  return (
    <section className="settings" aria-labelledby="settings-title">
      <h2 id="settings-title">Preferências</h2>
      <p>
        Fonte, idioma, fornecedores e modelo ficam salvos para a próxima sessão.
        Isso não inicia captura ou envio e não altera uma sessão em andamento.
        Para trocar a fonte agora, pare a sessão e inicie outra com nova
        confirmação.
      </p>
      <p role="status">{message}</p>
      {!draft || !snapshot ? (
        <p>Preferências indisponíveis até concluir a leitura.</p>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(
                () => window.meetingCopilot.savePreferences(draft),
                true,
              );
            }}
          >
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
              {connection}
            </fieldset>
            <button type="submit" disabled={busy}>
              Salvar preferências
            </button>
          </form>
        </>
      )}
      <section aria-labelledby="privacy-title">
        <h3 id="privacy-title">Permissões e privacidade</h3>
        <p>
          A captura da fonte selecionada exige confirmação ao iniciar cada
          sessão. O macOS também controla as permissões de microfone e gravação
          de tela/áudio do sistema. Confirme que os demais participantes
          autorizaram a transcrição.
        </p>
        <p>
          O envio de texto à OpenAI exige autorização separada a cada sessão. As
          falas recentes ficam em memória e são limpas ao parar. Áudio nunca é
          enviado no modo local.
        </p>
      </section>
    </section>
  );
}
