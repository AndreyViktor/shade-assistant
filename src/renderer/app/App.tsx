import { SettingsDisclosure } from '../features/settings/SettingsDisclosure';
import { useEffect, useState } from 'react';
import { ipcFailure } from '../../contracts/ipc/appStatus';
import type { AppStatusResult } from '../../contracts/ipc/appStatus';

export function App() {
  const [result, setResult] = useState<AppStatusResult | null>(null);
  useEffect(() => {
    let active = true;
    async function loadStatus() {
      try {
        const status = await window.meetingCopilot.getStatus();
        if (active) setResult(status);
      } catch {
        if (active) setResult(ipcFailure('UNAVAILABLE'));
      }
    }
    void loadStatus();
    return () => {
      active = false;
    };
  }, []);
  const unavailable = result ? 'Indisponível' : 'Verificando…';

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">ASSISTENTE DE REUNIÕES</p>
        <h1>Meeting Copilot</h1>
        <p className="mode" aria-label="Modo demonstração">
          DEMO
        </p>
      </header>
      <section aria-labelledby="welcome-title" className="welcome">
        <h2 id="welcome-title">Seu painel de reunião</h2>
        <p>
          A demonstração com transcrições e sugestões ainda não está disponível.
        </p>
        {result && !result.ok && (
          <p role="alert">
            Não foi possível verificar o estado do aplicativo. Reabra o app.
          </p>
        )}
        <dl className="status-grid">
          <div>
            <dt>Captura</dt>
            <dd>{result?.ok ? 'Inativa' : unavailable}</dd>
          </div>
          <div>
            <dt>Conexão com IA</dt>
            <dd>{result?.ok ? 'Desativada' : unavailable}</dd>
          </div>
          <div>
            <dt>Dados enviados</dt>
            <dd>{result?.ok ? 'Nenhum' : unavailable}</dd>
          </div>
        </dl>
      </section>
      <SettingsDisclosure />
      <footer>
        <p>Nenhum áudio é capturado. Nenhuma chave de API é necessária.</p>
        <p>
          Para minimizar ou mostrar o painel, use o menu Janela e seus atalhos.
          Você também pode reabrir pelo Dock.
        </p>
      </footer>
    </main>
  );
}
