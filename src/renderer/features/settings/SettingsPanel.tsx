import { useEffect, useRef, useState } from 'react';
import { parsePreferences } from '../../../contracts/settings/preferences';
import type { Preferences } from '../../../contracts/settings/preferences';
import type {
  SettingsResult,
  SettingsSnapshot,
} from '../../../contracts/ipc/settings';

export function SettingsPanel({ active = true }: { active?: boolean }) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const loaded = useRef(false);
  useEffect(() => {
    if (!active && loaded.current) return;
    let current = true;
    async function load() {
      try {
        const result = await window.meetingCopilot.getSettings();
        if (!current) return;
        if (!result.ok) throw new Error('UNAVAILABLE');
        loaded.current = true;
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
        O idioma fica salvo para a próxima sessão. Isso não inicia a captura.
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
              <legend>Transcrição local</legend>
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
              <button type="submit">Salvar preferências</button>
            </fieldset>
          </form>
          <details className="advanced-settings">
            <summary>Chave OpenAI (não usada na transcrição local)</summary>
            <p>
              Estado:{' '}
              {snapshot.credential === 'stored'
                ? 'armazenada no cofre do Mac'
                : snapshot.credential === 'development'
                  ? 'fornecida pelo ambiente de desenvolvimento'
                  : 'não configurada'}
            </p>
            <p>
              Esta chave permite gerar sugestões de IA quando você ativar essa
              opção ao iniciar uma sessão. A transcrição local funciona sem ela.
            </p>
            <p>
              Importe um arquivo de texto contendo somente sua chave da API
              OpenAI. O app a guarda protegida no Mac e nunca a exibe. Importar
              a chave não inicia envios nem cobranças.
            </p>
            <div className="settings-actions">
              <button
                disabled={busy || snapshot.credential === 'development'}
                onClick={() => {
                  void perform(() => window.meetingCopilot.importSecret());
                }}
              >
                Importar chave
              </button>
              <button
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
                Para remover a chave de desenvolvimento, encerre o app e retire
                OPENAI_API_KEY do ambiente.
              </p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
