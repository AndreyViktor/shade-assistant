export function App() {
  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">SEU ASSISTENTE DE REUNIÕES</p>
        <h1>Meeting Copilot</h1>
        <p className="mode" aria-label="Modo demonstração">
          DEMO
        </p>
      </header>
      <section aria-labelledby="welcome-title" className="welcome">
        <h2 id="welcome-title">Um espaço para acompanhar sua conversa.</h2>
        <p>
          A base do aplicativo está pronta para as próximas etapas. A
          demonstração com transcrições e sugestões ainda não está disponível.
        </p>
        <dl className="status-grid">
          <div>
            <dt>Captura</dt>
            <dd>Inativa</dd>
          </div>
          <div>
            <dt>Conexão com IA</dt>
            <dd>Desativada</dd>
          </div>
          <div>
            <dt>Dados enviados</dt>
            <dd>Nenhum</dd>
          </div>
        </dl>
      </section>
      <footer>
        Nenhum áudio é capturado. Nenhuma chave de API é necessária.
      </footer>
    </main>
  );
}
