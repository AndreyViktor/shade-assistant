import { useEffect, useState } from 'react';
import { SHORTCUT_ACTIONS } from '../../../contracts/shortcuts/configuration';
import type {
  ShortcutAction,
  ShortcutConfiguration,
} from '../../../contracts/shortcuts/configuration';

const labels: Record<ShortcutAction, string> = {
  window: 'Mostrar ou ocultar janela',
  pause: 'Pausar ou retomar',
  stop: 'Parar sessão',
  help: 'Pedir ajuda',
};
const choices = Array.from(
  { length: 12 },
  (_, index) => `CommandOrControl+Alt+Shift+F${index + 1}`,
);
export function ShortcutsPanel() {
  const [draft, setDraft] = useState<ShortcutConfiguration | null>(null);
  const [saved, setSaved] = useState<ShortcutConfiguration | null>(null);
  const [message, setMessage] = useState('Carregando atalhos…');
  const [confirm, setConfirm] = useState<'save' | 'restore' | null>(null);
  const [busy, setBusy] = useState(false);
  async function perform(action: 'read' | 'restore' | ShortcutConfiguration) {
    setBusy(true);
    const result = await window.meetingCopilot.shortcuts(action).catch(() => ({
      version: 1 as const,
      ok: false as const,
      code: 'UNAVAILABLE' as const,
    }));
    if (result.ok) {
      setDraft(result.shortcuts);
      setSaved(result.shortcuts);
      setMessage(
        result.registered
          ? 'Atalhos ativos.'
          : 'Um ou mais atalhos não puderam ser registrados. Escolha outras combinações.',
      );
    } else
      setMessage(
        result.code === 'CONFLICT'
          ? 'Combinação indisponível ou em conflito. A configuração anterior foi restaurada quando possível.'
          : 'Não foi possível atualizar os atalhos.',
      );
    setBusy(false);
  }
  useEffect(() => {
    let active = true;
    void window.meetingCopilot
      .shortcuts('read')
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setDraft(result.shortcuts);
          setSaved(result.shortcuts);
          setMessage(
            result.registered
              ? 'Atalhos ativos.'
              : 'Um ou mais atalhos não puderam ser registrados. Escolha outras combinações.',
          );
        } else setMessage('Não foi possível carregar os atalhos.');
      })
      .catch(() => {
        if (active) setMessage('Não foi possível carregar os atalhos.');
      });
    return () => {
      active = false;
    };
  }, []);
  const duplicate =
    draft && new Set(Object.values(draft)).size !== SHORTCUT_ACTIONS.length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  return (
    <section aria-label="Atalhos globais">
      <p>
        As combinações usam teclas de função com modificadores, evitando
        interceptar texto. Elas funcionam mesmo quando o painel não está em
        foco. Ocultar a janela não garante invisibilidade em compartilhamentos.
      </p>
      <p role="status">{message}</p>
      {draft && (
        <fieldset disabled={busy}>
          <legend>Combinações globais</legend>
          {SHORTCUT_ACTIONS.map((action) => (
            <label key={action}>
              {labels[action]}
              <select
                value={draft[action]}
                onChange={(event) =>
                  setDraft({ ...draft, [action]: event.target.value })
                }
              >
                {choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}
      {duplicate && (
        <p role="alert">Escolha combinações diferentes para cada ação.</p>
      )}
      <div className="settings-actions">
        <button
          type="button"
          disabled={busy || !draft || !dirty || !!duplicate}
          onClick={() => setConfirm('save')}
        >
          Aplicar atalhos
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirm('restore')}
        >
          Restaurar padrões
        </button>
      </div>
      {confirm && (
        <div role="group" aria-label="Confirmar alteração de atalhos">
          <p>
            Confirmar{' '}
            {confirm === 'save'
              ? 'as combinações escolhidas'
              : 'os atalhos padrão'}
            ?
          </p>
          <button type="button" onClick={() => setConfirm(null)}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              const action = confirm;
              setConfirm(null);
              if (action === 'restore') void perform('restore');
              else if (draft) void perform(draft);
            }}
          >
            Confirmar
          </button>
        </div>
      )}
    </section>
  );
}
