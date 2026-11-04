import { useEffect, useRef, useState } from 'react';
import type { SessionRequest } from '../../../contracts/ipc/session';
import type { SessionSnapshot } from '../../../contracts/meeting/session';

const phaseLabels = {
  idle: 'Não iniciada',
  running: 'Em andamento',
  paused: 'Pausada',
  stopped: 'Encerrada',
};

export function SessionControls() {
  const [session, setSession] = useState<SessionSnapshot | null>(null);
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
          version: 1,
          action: 'read',
        });
        if (!active || revision.current !== initialRevision) return;
        if (result.ok) setSession(result.session);
        else setError('Não foi possível verificar a sessão. Reabra o app.');
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
      if (result.ok) setSession(result.session);
      else {
        setSession(null);
        setError(
          'Não foi possível confirmar a ação. Use Parar ou reabra o app.',
        );
      }
    } catch {
      if (mounted.current) {
        setSession(null);
        setError(
          'Não foi possível confirmar a ação. Use Parar ou reabra o app.',
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const canStart = session?.phase === 'idle' || session?.phase === 'stopped';
  return (
    <section className="session-controls" aria-labelledby="session-title">
      <h2 id="session-title">Sessão DEMO</h2>
      <p role="status">
        {session ? phaseLabels[session.phase] : 'Estado não confirmado'}
      </p>
      <p>
        Iniciar DEMO exercita os controles sem microfone, áudio do sistema ou
        rede. Transcrições e sugestões simuladas ainda não estão disponíveis.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="settings-actions">
        <button
          disabled={busy || !canStart}
          onClick={() => {
            void command({
              version: 1,
              action: 'start',
              options: {
                mode: 'demo',
                consent: { capture: false, context: false, remoteAudio: false },
              },
            });
          }}
        >
          Iniciar DEMO
        </button>
        <button
          disabled={busy || session?.phase !== 'running'}
          onClick={() => {
            void command({ version: 1, action: 'pause' });
          }}
        >
          Pausar
        </button>
        <button
          disabled={busy || session?.phase !== 'paused'}
          onClick={() => {
            void command({ version: 1, action: 'resume' });
          }}
        >
          Retomar
        </button>
        <button
          disabled={busy}
          onClick={() => {
            void command({ version: 1, action: 'stop' });
          }}
        >
          Parar
        </button>
      </div>
      <details className="data-consent">
        <summary>Consentimento e dados enviados à nuvem</summary>
        <p>
          DEMO: nenhuma captura, nenhum envio e nenhum custo de API. Salvar
          preferências ou uma chave não concede consentimento.
        </p>
        <p>
          APPLE LOCAL (SWIFT): integração indisponível. Quando disponível, a
          captura exigirá início manual e autorização; o áudio ficará no Mac.
          Texto de contexto só poderá ir à OpenAI com autorização separada.
        </p>
        <p>
          OPENAI STT: indisponível. O fallback remoto exigirá autorização
          específica para enviar áudio e aceitar custos de API, cobrados
          separadamente da assinatura ChatGPT.
        </p>
        <p>
          Screenshots exigirão prévia e confirmação de cada imagem. Não há
          autorização para imagens nesta sessão.
        </p>
        <p>
          Pausar ou parar bloqueia novos envios e cancela trabalho pendente;
          dados já enviados não podem ser recuperados. Parar elimina as
          autorizações da sessão. O consentimento no app não substitui as
          permissões do Mac nem a autorização dos participantes.
        </p>
      </details>
    </section>
  );
}
