import { useEffect, useRef, useState } from 'react';
import type { SessionRequest } from '../../../contracts/ipc/session';
import type { SessionSnapshot } from '../../../contracts/meeting/session';
import { emptyDemo } from '../../../contracts/meeting/demo';

export function useMeetingSession() {
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [demo, setDemo] = useState(emptyDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const pending = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const initialRevision = revision.current;
    async function load() {
      try {
        const result = await window.meetingCopilot.session({
          version: 2,
          action: 'read',
        });
        if (!active || revision.current !== initialRevision) return;
        if (result.ok) {
          setSession(result.session);
          setDemo(result.demo);
        } else setError('Não foi possível verificar a sessão. Reabra o app.');
      } catch {
        if (active && revision.current === initialRevision)
          setError('Não foi possível verificar a sessão. Reabra o app.');
      }
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
        setSession(null);
        setDemo(emptyDemo());
        setError(
          'Não foi possível confirmar a ação. Use Parar ou reabra o app.',
        );
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

  return { session, demo, busy, error, command };
}
