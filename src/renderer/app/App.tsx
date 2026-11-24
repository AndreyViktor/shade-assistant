import { useMeetingSession } from '../features/meeting/useMeetingSession';
import { TranscriptionDiagnostics } from '../features/meeting/TranscriptionDiagnostics';
import { SuggestionDiagnosticsPanel } from '../features/suggestions/SuggestionDiagnosticsPanel';
import { DemoDiagnostics } from '../features/meeting/DemoDiagnostics';
import type { Preferences } from '../../contracts/settings/preferences';
import {
  SessionControls,
  type OverlayMode,
} from '../features/meeting/SessionControls';
import { SettingsDisclosure } from '../features/settings/SettingsDisclosure';
import { useEffect, useState } from 'react';
import { ipcFailure } from '../../contracts/ipc/appStatus';
import type { AppStatusResult } from '../../contracts/ipc/appStatus';

export function App() {
  const meeting = useMeetingSession();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [result, setResult] = useState<AppStatusResult | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('complete');
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
  useEffect(() => {
    const setEditing = window.meetingCopilot?.setShortcutEditing;
    if (typeof setEditing !== 'function') return;
    const update = () => {
      const element = document.activeElement;
      const editing =
        document.hasFocus() &&
        element instanceof HTMLElement &&
        (element.isContentEditable ||
          element instanceof HTMLTextAreaElement ||
          (element instanceof HTMLInputElement &&
            ![
              'button',
              'checkbox',
              'radio',
              'submit',
              'reset',
              'range',
              'file',
              'color',
            ].includes(element.type)));
      void setEditing(editing);
    };
    document.addEventListener('focusin', update);
    const afterBlur = () => queueMicrotask(update);
    document.addEventListener('focusout', afterBlur);
    window.addEventListener('blur', update);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', afterBlur);
      window.removeEventListener('blur', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  const appError =
    result && !result.ok
      ? 'Não foi possível verificar o estado do app. Reabra-o.'
      : '';
  return (
    <main className="app-shell">
      <SettingsDisclosure
        demoSummary={
          !result?.ok || !meeting.session
            ? 'DEMO indisponível'
            : meeting.session.phase === 'running' ||
                meeting.session.phase === 'paused'
              ? meeting.session.mode === 'demo'
                ? 'DEMO offline em andamento'
                : 'DEMO indisponível durante a sessão'
              : 'DEMO offline disponível'
        }
        sessionSummary={
          meeting.session
            ? (
                {
                  idle: 'Sessão inativa',
                  running: 'Sessão em andamento',
                  paused: 'Sessão pausada',
                  stopped: 'Sessão encerrada',
                } as const
              )[meeting.session.phase]
            : 'Sessão indisponível'
        }
        onSaved={setPreferences}
        connection={
          <SuggestionDiagnosticsPanel snapshot={meeting.suggestions} />
        }
        diagnostics={
          <>
            <TranscriptionDiagnostics
              transcript={meeting.local}
              error={appError || meeting.error}
            />
            <details className="privacy-details">
              <summary>Sobre o histórico de transcrição</summary>
              <p>
                Falas recentes em ordem de início, com tempos relativos à
                sessão. A fonte de áudio não identifica a pessoa. Finais iguais
                e próximos nas duas fontes podem ser agrupados como possível
                eco, exibindo Sistema; falas simultâneas iguais também podem ser
                agrupadas.
              </p>
            </details>
            {result?.ok && <DemoDiagnostics meeting={meeting} />}
          </>
        }
      >
        <SessionControls
          meeting={meeting}
          overlayMode={overlayMode}
          onOverlayModeChange={setOverlayMode}
          savedPreferences={preferences}
          available={result?.ok === true}
          appError={appError}
        />
      </SettingsDisclosure>
    </main>
  );
}
