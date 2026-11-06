import { SessionControls } from '../features/meeting/SessionControls';
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
  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">TRANSCRIÇÃO LOCAL</p>
        <h1>Meeting Copilot</h1>
        <p className="app-intro">
          Escolha as fontes e inicie quando estiver pronto. O áudio permanece
          neste Mac.
        </p>
      </header>
      {result?.ok && <SessionControls />}
      {result && !result.ok && (
        <p role="alert">
          Não foi possível verificar o estado do app. Reabra-o.
        </p>
      )}
      <SettingsDisclosure />
    </main>
  );
}
