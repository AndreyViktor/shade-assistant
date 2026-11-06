import { useEffect, useRef, useState } from 'react';
import type { SessionRequest } from '../../../contracts/ipc/session';
import type { SessionSnapshot } from '../../../contracts/meeting/session';
import { emptyDemo } from '../../../contracts/meeting/demo';
import type { Preferences } from '../../../contracts/settings/preferences';
import type { IpcErrorCode } from '../../../contracts/ipc/appStatus';

export function useMeetingSession() {
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [demo, setDemo] = useState(emptyDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const initialRevision = revision.current;
    async function load() {
      const [result, settings] = await Promise.all([
        window.meetingCopilot
          .session({ version: 2, action: 'read' })
          .catch(() => null),
        Promise.resolve()
          .then(() => window.meetingCopilot.getSettings())
          .catch(() => null),
      ]);
      if (!active || revision.current !== initialRevision) return;
      if (settings?.ok) setPreferences(settings.settings.preferences);
      if (result?.ok) {
        setSession(result.session);
        setDemo(result.demo);
      } else setError('Não foi possível verificar a sessão. Reabra o app.');
    }
    void load();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, []);

  async function command(request: SessionRequest) {
    if (pending.current) return;
    pending.current = true;
    revision.current += 1;
    setBusy(true);
    setError('');
    try {
      const result = await window.meetingCopilot.session(request);
      if (!mounted.current) return;
      if (result.ok) {
        setSession(result.session);
        setDemo(result.demo);
      } else {
        setDemo(emptyDemo());
        try {
          const current = await window.meetingCopilot.session({
            version: 2,
            action: 'read',
          });
          if (current.ok) setSession(current.session);
        } catch {
          // Keep the last confirmed session state if a refresh also fails.
        }
        setError(sessionErrorMessage(result.code));
      }
    } catch {
      if (mounted.current) {
        setSession(null);
        setDemo(emptyDemo());
        setError(
          'Não foi possível confirmar a ação. Use Parar ou reabra o app.',
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const polling =
    (session?.phase === 'running' && !demo.completed) ||
    ((session?.phase === 'running' || session?.phase === 'paused') &&
      demo.suggestions.length > 0);
  useEffect(() => {
    if (!polling || busy) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const currentRevision = revision.current;
    async function poll() {
      try {
        const result = await window.meetingCopilot.session({
          version: 2,
          action: 'read',
        });
        if (!active || revision.current !== currentRevision) return;
        if (!result.ok) throw new Error('Unavailable');
        setSession(result.session);
        setDemo(result.demo);
        if (
          (result.session.phase === 'running' && !result.demo.completed) ||
          ((result.session.phase === 'running' ||
            result.session.phase === 'paused') &&
            result.demo.suggestions.length > 0)
        )
          timer = setTimeout(() => {
            void poll();
          }, 500);
      } catch {
        if (!active || revision.current !== currentRevision) return;
        setSession(null);
        setDemo(emptyDemo());
        setError(
          'Não foi possível atualizar a sessão. Use Parar ou reabra o app.',
        );
      }
    }
    timer = setTimeout(() => {
      void poll();
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [polling, busy]);

  return { session, demo, busy, error, preferences, command };
}

function sessionErrorMessage(code: IpcErrorCode): string {
  switch (code) {
    case 'CAPTURE_CONSENT_REQUIRED':
      return 'Confirme a autorização de captura antes de iniciar.';
    case 'REMOTE_STT_DEFERRED':
      return 'OPENAI STT está adiado e indisponível nesta versão.';
    case 'CAPTURE_PERMISSION_REQUIRED':
      return 'O macOS não concedeu a permissão de captura. Para áudio do sistema em desenvolvimento (`npm run dev`), habilite o Terminal que iniciou o app em Ajustes do Sistema › Privacidade e Segurança › Gravação de Tela e Áudio do Sistema; depois feche e reabra o Terminal e o Meeting Copilot.';
    case 'TRANSCRIPTION_ASSETS_UNAVAILABLE':
      return 'Assets do idioma Apple não estão disponíveis. Prepare o idioma e tente novamente.';
    case 'TRANSCRIPTION_LOCALE_UNSUPPORTED':
      return 'Este idioma ainda não é compatível com Apple Local neste Mac.';
    case 'TRANSCRIPTION_UNAVAILABLE':
      return 'Apple Local requer macOS e o helper Meeting Copilot disponível.';
    case 'TRANSCRIPTION_START_FAILED':
      return 'A captura Apple Local não iniciou. Confira permissões e tente novamente.';
    case 'INVALID_REQUEST':
      return 'A seleção da sessão é inválida ou há outra sessão em andamento.';
    default:
      return 'Não foi possível confirmar a ação. Use Parar ou reabra o app.';
  }
}
