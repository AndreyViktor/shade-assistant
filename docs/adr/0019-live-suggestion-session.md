# ADR 0019 — Sugestões na sessão Apple Local

Data: 2026-11-11. Escopo: implementação T024, aceite real pendente.

## Contexto

ContextManager, TriggerEngine, SuggestionScheduler e provider OpenAI já existem. A sessão Apple Local precisa compô-los e entregar cartões ao overlay sem conceder autorização implícita de nuvem ou expor credenciais.

## Decisão

- `MeetingSuggestions` no core compõe contexto, gatilhos e scheduler por sessão. Recebe somente eventos aceitos pelo transcript local; apenas falas finais e resumo limitado entram no contexto enviado. Revisões ignoram atualizações sem mudança do conteúdo final. O relógio avança durante silêncio para retirar falas antigas da janela; isso não dispara inferência.
- O main cria o provider com modelo explícito e callback de autorização ligado à geração e ao consentimento da sessão. A chave é lida pelo serviço de settings somente quando uma tentativa autorizada chega ao provider; nunca por IPC, renderer ou logs. A composição usa o adapter existente, sem nova dependência.
- IPC de sessão passa de v3 para v4, com snapshot `suggestions`, ação `revoke-suggestions` e autorização opcional `{model, maxRequests}` no start Apple Local. Consentimento de contexto e autorização devem estar presentes juntos. Chamadas v3, campos desconhecidos, modelos inválidos e limites fora de 1–100 são rejeitados. O protocolo JSONL Swift permanece v1.
- O diálogo inicia com envio de texto desmarcado; informa destino `api.openai.com`, texto final/resumo, custo separado e ausência de áudio/imagem. Desde a correção de 2026-11-12, o modelo é escolhido em lista local com GPT-5.4 mini como opção inicial e GPT-5.4 como alternativa; a seleção não concede consentimento. Capacidades/fontes e limites da lista estão em TEST-T024.md. Limite inicial de uma tentativa por sessão, contando falhas e leituras de chave que não completam. Esse limite não estima dinheiro nem substitui T025. O request usa `store: false` e até 2.048 tokens de saída; cancelamento não desfaz dados já enviados.
- Orçamento é consumido antes de chamar o provider. A autorização de sessão permanece verdadeira para aceitar a resposta da última tentativa permitida; zero tentativas restantes impede novos dispatches, sem apagar por si só o último cartão válido. Pausa não reabastece o limite. Revogação desliga sugestões e limpa contexto/cartões, mantendo transcrição local.
- Pausa, parada, erro, reload e fechamento abortam trabalho pendente. Uma instância de scheduler é mantida entre sessões para respeitar o slot de execução mesmo se um provider ignorar cancelamento. Respostas de gerações antigas são descartadas.
- O main bloqueia novo start durante inicialização ou parada do helper. Stop invalida inclusive uma solicitação de permissão ainda pendente. Quit aguarda os cleanups registrados, inclusive criação tardia do provider; fechamento mantém o cleanup registrado até terminar. As tentativas de cleanup usam o comportamento de timeout/terminação já existente no provider. Isso não comprova encerramento físico em falha de SO ou em captura real; O008 continua exigindo ensaio Mac.
- O renderer consulta snapshots e reutiliza SuggestionCards, com identificação DEMO somente para cartões simulados da demonstração. Gatilhos automáticos são pt-BR; botão manual de produto fica em T026. Semântica de relevância, invalidação conservadora e latência continuam sujeitas à avaliação T027.

## Evidências e limites

Testes de core/main/contrato/UI, transporte sintético e E2E com processo JSONL sintético verificam composição, opt-in, orçamento, revogação e limpeza. Bootstrap de teste usa perfil temporário, chave falsa e interceptação de transporte com rede bloqueada; não existe flag de mock no produto. Evidências e roteiro de aceite real em [TEST-T024.md](../TEST-T024.md).

A implementação não significa autorização para capturar ou enviar reuniões. T024 permanece BLOCKED até ensaio Mac real explicitamente autorizado, com modelo/preço/acesso confirmados e dados sintéticos definidos.
