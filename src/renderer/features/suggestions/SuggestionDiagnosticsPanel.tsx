import type { SuggestionSessionSnapshot } from '../../../contracts/meeting/suggestionSession';
import type {
  SuggestionDiagnostics,
  SuggestionFailure,
} from '../../../contracts/meeting/suggestionDiagnostics';

const activities: Record<SuggestionDiagnostics['activity'], string> = {
  'waiting-final': 'Aguardando uma fala final da transcrição.',
  'waiting-trigger': 'Aguardando novos trechos finais da transcrição.',
  debounce: 'Aguardando a fala estabilizar por 0,5 segundo.',
  cooldown:
    'Aguardando o intervalo entre chamadas (10 segundos) ou a chamada anterior encerrar.',
  preparing: 'Preparando a chamada e lendo a chave no Mac.',
  requesting: 'Requisição em andamento. Aguardando a resposta da OpenAI.',
  paused: 'Sessão pausada. Novas chamadas estão suspensas.',
};
const failures: Record<SuggestionFailure, string> = {
  'not-authorized': 'Envio não autorizado nesta sessão.',
  'credentials-unavailable':
    'Chave indisponível. Confira OPENAI_API_KEY no .env e reinicie o app, ou importe a chave em Preferências.',
  'invalid-request':
    'Configuração ou contexto inválido. Confira o modelo e inicie uma nova sessão.',
  cancelled:
    'Chamada cancelada por mudança de contexto, pausa ou prazo limite. Uma chamada já enviada pode ter custo.',
  timeout:
    'A resposta não chegou dentro do prazo. Confira a conexão antes de tentar em uma nova sessão.',
  network:
    'Não foi possível concluir a conexão. Confira a rede, VPN ou proxy. Não houve resposta HTTP confirmada.',
  authentication:
    'Autenticação ou acesso negado. Confira a chave, o projeto e suas permissões.',
  'rate-limited':
    'Limite da API atingido. Confira créditos, orçamento e limites de uso na plataforma OpenAI; HTTP 429 pode ter mais de uma causa.',
  unavailable:
    'Serviço indisponível. Aguarde e confira o estado da API antes de uma nova tentativa.',
  rejected:
    'A API rejeitou a requisição. Confira o modelo selecionado, o acesso no projeto e o corpo enviado.',
  refused: 'A API recusou produzir sugestões para esse conteúdo.',
  incomplete:
    'A API retornou uma resposta incompleta; nenhum cartão foi publicado.',
  'invalid-response':
    'A resposta não corresponde ao formato esperado; nenhum cartão foi publicado.',
};
const triggers: Record<SuggestionDiagnostics['lastTrigger'], string> = {
  none: 'Nenhum',
  question: 'Pergunta',
  objection: 'Objeção',
  commitment: 'Compromisso',
  manual: 'Manual',
};
function readableBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body) as unknown, null, 2);
  } catch {
    return body;
  }
}

export function SuggestionDiagnosticsPanel({
  snapshot,
}: {
  snapshot: SuggestionSessionSnapshot;
}) {
  const diagnostic = snapshot.diagnostics;
  const attempt = diagnostic?.lastAttempt;
  const pending = attempt?.result === 'pending';
  const result = !attempt
    ? snapshot.status === 'unavailable'
      ? failures.unavailable
      : 'Conexão ainda não testada nesta sessão.'
    : attempt.result === 'pending'
      ? 'Tentativa em andamento.'
      : attempt.result === 'success'
        ? `Resposta válida: ${attempt.suggestionCount} sugestão(ões) recebida(s).`
        : attempt.result === 'empty'
          ? 'Resposta válida, sem sugestões para esse contexto.'
          : failures[attempt.result];
  return (
    <section className="suggestion-diagnostics" aria-label="Estado da OpenAI">
      <h3>Estado da OpenAI</h3>
      <p role="status">
        {!diagnostic
          ? 'Sugestões desativadas. Inicie uma nova sessão com “Adicionar sugestões de IA” para autorizar o envio.'
          : pending
            ? activities[diagnostic.activity]
            : snapshot.remainingRequests === 0
              ? 'Limite atingido. Nenhuma nova chamada será feita nesta sessão.'
              : activities[diagnostic.activity]}
      </p>
      {diagnostic && <p>{result}</p>}
      <details>
        <summary>Diagnóstico OpenAI</summary>
        <p>
          Este painel acompanha as chamadas da sessão; abrir aqui não testa a
          chave nem envia dados.
        </p>
        {!diagnostic ? (
          <p>
            Nenhum envio autorizado. A transcrição local funciona sem OpenAI.
          </p>
        ) : (
          <>
            <dl>
              <dt>Modelo</dt>
              <dd>{diagnostic.model}</dd>
              <dt>Tentativas</dt>
              <dd>
                {diagnostic.maxRequests - snapshot.remainingRequests} de{' '}
                {diagnostic.maxRequests}; {snapshot.remainingRequests} restantes
              </dd>
              <dt>Classificação local informativa</dt>
              <dd>{triggers[diagnostic.lastTrigger]}</dd>
              <dt>Destino</dt>
              <dd>POST https://api.openai.com/v1/responses</dd>
              <dt>Resposta HTTP</dt>
              <dd>
                {attempt?.httpStatus
                  ? `HTTP ${attempt.httpStatus} recebido`
                  : 'Nenhuma resposta HTTP recebida'}
              </dd>
              <dt>Última tentativa</dt>
              <dd>
                {attempt
                  ? `#${attempt.number} às ${new Date(attempt.startedAt).toLocaleTimeString('pt-BR')}`
                  : 'Nenhuma'}
              </dd>
              <dt>Duração</dt>
              <dd>
                {attempt?.durationMs != null
                  ? `${(attempt.durationMs / 1000).toFixed(1)} s`
                  : pending
                    ? 'Em andamento'
                    : '—'}
              </dd>
            </dl>
            <p>
              Falhas também consomem uma tentativa. Para repetir após esgotar o
              limite, pare e inicie outra sessão autorizada. Ter uma chave
              configurada não confirma acesso à API.
            </p>
            {attempt?.result === 'success' && (
              <p>
                Todos os cartões recebidos permanecem até descarte ou limpeza ao
                pausar, parar, desativar sugestões ou encerrar a transcrição.
                Conteúdo repetido pode ser suprimido.
              </p>
            )}
            <details>
              <summary>Ver corpo da última requisição</summary>
              <p>
                Texto, resumo, instruções e formato de resposta. Sem cabeçalhos
                de autenticação. O envio é registrado ao chamar o transporte; só
                uma resposta HTTP confirma retorno do servidor.
              </p>
              {attempt?.requestBody ? (
                <pre tabIndex={0} aria-label="Corpo da requisição OpenAI">
                  {readableBody(attempt.requestBody)}
                </pre>
              ) : (
                <p>
                  Nenhum corpo disponível: ainda não houve envio ou o conteúdo
                  foi limpo ao pausar.
                </p>
              )}
            </details>
          </>
        )}
        <p>
          Teste sugerido: em uma sessão autorizada, com idioma Português
          (Brasil), diga “Qual é o prazo do projeto fictício Aurora?” e aguarde
          a fala final e a resposta. Falas finais são agrupadas para avaliação;
          o modelo pode responder sem sugestões.
        </p>
        <p>
          O diagnóstico guarda apenas a última tentativa em memória. Pausar
          limpa o corpo; parar ou desativar sugestões limpa todo o diagnóstico.
          Não há histórico salvo em disco.
        </p>
      </details>
    </section>
  );
}
