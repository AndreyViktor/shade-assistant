import { useMeetingSession } from './useMeetingSession';
import { DemoPreview } from './DemoPreview';

const phaseLabels = {
  idle: 'Não iniciada',
  running: 'Em andamento',
  paused: 'Pausada',
  stopped: 'Encerrada',
};

export function SessionControls() {
  const { session, demo, busy, error, command } = useMeetingSession();
  const canStart = session?.phase === 'idle' || session?.phase === 'stopped';
  return (
    <section className="session-controls" aria-labelledby="session-title">
      <h2 id="session-title">Sessão DEMO</h2>
      <p role="status">
        {session ? phaseLabels[session.phase] : 'Estado não confirmado'}
      </p>
      <p>
        Iniciar DEMO reproduz falas e sugestões fixas em pt-BR. As fontes são
        simuladas: sem captura, rede, chave ou custo de API.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="settings-actions">
        <button
          disabled={busy || !canStart}
          onClick={() => {
            void command({
              version: 2,
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
            void command({ version: 2, action: 'pause' });
          }}
        >
          Pausar
        </button>
        <button
          disabled={busy || session?.phase !== 'paused'}
          onClick={() => {
            void command({ version: 2, action: 'resume' });
          }}
        >
          Retomar
        </button>
        <button
          disabled={busy}
          onClick={() => {
            void command({ version: 2, action: 'stop' });
          }}
        >
          Parar
        </button>
      </div>
      {session && (
        <DemoPreview
          demo={demo}
          phase={session.phase}
          busy={busy}
          onDismiss={(id) => {
            void command({ version: 2, action: 'dismiss-suggestion', id });
          }}
        />
      )}
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
