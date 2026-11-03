import { useEffect, useState } from 'react';
import { parsePreferences } from '../../../contracts/settings/preferences';
import type { Preferences } from '../../../contracts/settings/preferences';
import type {
  SettingsResult,
  SettingsSnapshot,
} from '../../../contracts/ipc/settings';

export function SettingsPanel() {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await window.meetingCopilot.getSettings();
        if (!active) return;
        if (!result.ok) throw new Error('UNAVAILABLE');
        setSnapshot(result.settings);
        setDraft(result.settings.preferences);
      } catch {
        if (active)
          setMessage(
            'Não foi possível carregar as preferências. Reabra o app.',
          );
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function perform(action: () => Promise<SettingsResult>) {
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
      setDraft(result.settings.preferences);
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
        Salvar não inicia captura nem autoriza envio de dados. O modo real e a
        validação dos idiomas ainda não estão disponíveis.
      </p>
      <p role="status">{message}</p>
      {!draft || !snapshot ? (
        <p>Preferências indisponíveis até concluir a leitura.</p>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void perform(() => window.meetingCopilot.savePreferences(draft));
            }}
          >
            <fieldset disabled={busy}>
              <legend>Próxima reunião</legend>
              <label>
                Modo preferido
                <select
                  value={draft.mode}
                  onChange={(event) => change('mode', event.target.value)}
                >
                  <option value="demo">DEMO — sem rede e sem chave</option>
                  <option value="real">Real — ainda indisponível</option>
                </select>
              </label>
              <label>
                Provedor STT preferido
                <select
                  value={draft.sttProvider}
                  onChange={(event) =>
                    change('sttProvider', event.target.value)
                  }
                >
                  <option value="apple-local">
                    APPLE LOCAL (SWIFT) — integração pendente
                  </option>
                  <option value="mock">Mock — demonstração</option>
                  <option value="openai-stt" disabled>
                    OPENAI STT — exige consentimento futuro
                  </option>
                </select>
              </label>
              <label>
                Idiomas preferidos
                <select
                  value={draft.language}
                  onChange={(event) => change('language', event.target.value)}
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">Inglês (EUA)</option>
                  <option value="pt-BR+en-US">
                    Português + inglês — validação pendente
                  </option>
                </select>
              </label>
              <button type="submit">Salvar preferências</button>
            </fieldset>
          </form>
          <p>
            Chave OpenAI:{' '}
            {snapshot.credential === 'stored'
              ? 'armazenada; validade não verificada'
              : snapshot.credential === 'development'
                ? 'fornecida pelo ambiente de desenvolvimento'
                : 'não configurada'}
            .
          </p>
          <p>
            Importe um arquivo contendo somente a chave. Ela será protegida pelo
            cofre do Mac. O arquivo original continuará no local escolhido;
            remova-o manualmente se não precisar dele. Nenhuma chamada à API
            será feita.
          </p>
          <div className="settings-actions">
            <button
              disabled={busy || snapshot.credential === 'development'}
              onClick={() => {
                void perform(() => window.meetingCopilot.importSecret());
              }}
            >
              Importar chave pelo Mac
            </button>
            <button
              disabled={busy || snapshot.credential !== 'stored'}
              onClick={() => {
                void perform(() => window.meetingCopilot.removeSecret());
              }}
            >
              Remover chave armazenada
            </button>
          </div>
          {snapshot.credential === 'development' && (
            <p>
              Para remover a chave de desenvolvimento, encerre o app e retire
              OPENAI_API_KEY do ambiente.
            </p>
          )}
        </>
      )}
    </section>
  );
}
