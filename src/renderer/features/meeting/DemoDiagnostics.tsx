import type { useMeetingSession } from './useMeetingSession';
import { SESSION_IPC_VERSION } from '../../../contracts/ipc/session';
import { DemoPreview } from './DemoPreview';

export function DemoDiagnostics({
  meeting,
}: {
  meeting: ReturnType<typeof useMeetingSession>;
}) {
  const { session, demo, busy, error, command } = meeting;
  const canStart = session?.phase === 'idle' || session?.phase === 'stopped';
  const demoActive = session?.mode === 'demo' && !canStart;
  const phaseLabels = {
    idle: 'Pronta para iniciar',
    running: 'Em andamento',
    paused: 'Pausada',
    stopped: 'Encerrada',
  };

  return (
    <details className="secondary-mode">
      <summary>Diagnóstico · DEMO offline</summary>
      <section aria-label="Demonstração offline">
        <h2>DEMO · falas e sugestões simuladas</h2>
        <p>
          A DEMO usa falas simuladas em português. Não acessa o microfone, não
          captura áudio do sistema e não usa rede, chave ou OpenAI.
        </p>
        <p>Ao voltar ao painel, a simulação continua no estado atual.</p>
        {session && !canStart && !demoActive ? (
          <p role="status">
            Pare a transcrição no painel antes de iniciar a DEMO.
          </p>
        ) : (
          <p role="status">
            {session ? phaseLabels[session.phase] : 'Verificando…'}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="session-actions">
          <button
            disabled={busy || !canStart}
            onClick={() => {
              void command({
                version: SESSION_IPC_VERSION,
                action: 'start',
                options: {
                  mode: 'demo',
                  consent: {
                    capture: false,
                    context: false,
                    remoteAudio: false,
                  },
                },
              });
            }}
          >
            Iniciar DEMO
          </button>
          {demoActive && (
            <button
              disabled={busy}
              onClick={() => {
                void command({
                  version: SESSION_IPC_VERSION,
                  action: session.phase === 'paused' ? 'resume' : 'pause',
                });
              }}
            >
              {session.phase === 'paused' ? 'Retomar' : 'Pausar'}
            </button>
          )}
          {(demoActive || Boolean(error)) && (
            <button
              disabled={busy}
              onClick={() => {
                void command({
                  version: SESSION_IPC_VERSION,
                  action: 'stop',
                });
              }}
            >
              Parar
            </button>
          )}
        </div>
        {session?.mode === 'demo' && (
          <DemoPreview
            demo={demo}
            phase={session.phase}
            busy={busy}
            onDismiss={(id) => {
              void command({
                version: SESSION_IPC_VERSION,
                action: 'dismiss-suggestion',
                id,
              });
            }}
          />
        )}
      </section>
    </details>
  );
}
