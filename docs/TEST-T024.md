# T024 — integração de sugestões na sessão Apple Local

Data: 2026-11-11. Estado: `BLOCKED` somente pelo ensaio real; implementação e gates offline concluídos.

## Execução e autorização

O usuário pediu executar o runner para T023 e T024. T023 terminou no commit `59527e7`. A revisão automática rejeitou o lote irrestrito por possível envio de texto de reunião sem autorização explícita de payload/destino. Foi aprovada uma execução T024 restrita à implementação e testes sintéticos offline, sem captura, leitura de chave real, API paga ou permissões OS novas.

A sessão filha atingiu limite de uso antes do gate completo e do commit; o usuário pediu continuar. A sessão principal retomou as alterações existentes, corrigiu lint/formatação e executou os gates restantes. O script do repositório não foi alterado. Nenhum resultado de mock equivale a aceite real.

## Entrega

Eventos JSONL aceitos → contexto limitado → trigger pt-BR → scheduler → serialização Responses → cartões IPC v4 no overlay. Há opt-in de texto/custo por sessão, modelo explícito, limite de tentativas (default 1), descarte e revogação sem interromper a transcrição. Segredos permanecem no main. O fluxo DEMO é offline.

Ajustes de lifecycle impedem start durante inicialização/parada, invalidam start após stop durante prompt de permissão e fazem quit aguardar cleanup/criação tardia. Evidências são simuladas: não afirmar ausência de processo/captura residual no Mac real.

## Gates

Swift/JSONL não foram alterados; nenhuma captura real foi feita. Gates Swift não foram repetidos nesta mudança TypeScript/Electron.

- `npm run verify` com Node 26.0.0: lint, formatação, tipos, 744 testes TS aprovados (18 skipped), 12 testes do runner e build passaram. Foram corrigidos quatro erros de lint, formatação e dois fixtures antigos que ainda esperavam IPC v3; nenhuma regra ou teste foi desabilitado. São 25 testes TS novos em relação à T023.
- `npm run test:smoke`: 13/13 E2E passaram (incluindo dois novos), Electron real com dados sintéticos e rede bloqueada. Primeira execução no sandbox não lançou Electron (`SIGABRT`/`EPERM`); repetição com escalada aprovada passou. Essa aprovação permite o smoke offline, não o ensaio de captura/API.
- Casos adicionados: autorização estrita IPC v4, chave mock pendente com pause/stop/revoke/reload/failure, limite de tentativas, final/parcial, revisão, silêncio/expiração, respostas antigas, restart/cleanup e quit.
- E2E novo: processo JSONL sintético com uma pergunta, provider real com transporte Responses falso, perfil temporário e chave falsa. Consentimento false produz zero requests/cartões; true produz um request/cartão, descarte/revogação/stop e zero tentativas de rede.

## Correção de UX — 2026-11-12

Após relato do usuário de confusão entre modelo/chave e autorização sem contexto, o início local passou a apresentar fontes/idioma e informar que não requer OpenAI. Nenhum campo de nuvem aparece até selecionar sugestões opcionais.

- Diálogo dedicado `StartSessionDialog`: estado da chave, importação de arquivo pelo IPC de segredos existente (sem valor/caminho no renderer), modelo explicitamente diferenciado da chave e limite de pedidos explicado. Prefixo `sk-` no campo de modelo impede iniciar sugestões e orienta usar a importação.
- Ações distintas: “Iniciar transcrição”, “Iniciar com sugestões” e alternativa “Iniciar apenas a transcrição” quando a configuração opcional está aberta. Essa alternativa nunca concede consentimento de texto. Leitura/importação de chave não inicia sessão ou request.
- Teclado: Tab permanece no diálogo, Escape cancela e devolve foco ao botão inicial. Conteúdo rola independentemente das ações; campos legíveis no overlay 440 × 640. Capturas sintéticas `start-local.png` e `start-suggestions.png` inspecionadas visualmente em `test-results/` (artefatos locais ignorados pelo Git).
- Preferências explica o uso da chave para sugestões e atualiza seus metadados ao reabrir, preservando rascunho de idioma. Não houve alteração de STT, contratos IPC, provider ou persistência de segredo.
- `npm run verify`: 749 TS aprovados, 18 skipped, 12 runner, lint/formato/tipos/build. Cinco testes novos cobrem transcrição sem chave, importação mock, configuração incompleta, teclado e atualização dos metadados. `npm run test:smoke`: 13/13 aprovados após as correções, incluindo o fluxo novo e regressões de transcrição/teclado; rede bloqueada, perfil temporário e chave/transporte sintéticos.
- A primeira rodada detectou seletores ambíguos após renomear botões e foco perdido ao carregar Preferências somente na abertura. Corrigidos com seletores exatos e pré-carregamento dos metadados, mantendo as asserções de teclado.

O aceite real T024 permanece pendente. Esta correção foi validada somente com dados sintéticos, sem captura nem envio à OpenAI.

## Seleção de modelos — 2026-11-12

O usuário pediu uma lista para escolher o modelo, eliminando a necessidade de digitar seu identificador. O diálogo usa catálogo local em `suggestionModels.ts`, com dois modelos e descrição por opção. `gpt-5.4-mini` é a opção inicial de menor custo; `gpt-5.4` é alternativa para tarefas complexas. A indicação inicial é decisão de produto, não resultado de comparação real de qualidade/latência no app.

Fontes oficiais consultadas em 12/11/2026:

- [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini): Responses e Structured Outputs; preço padrão publicado de US$ 0,75/1M tokens de entrada e US$ 4,50/1M de saída; reasoning `none` por padrão.
- [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4): mesmas capacidades necessárias, US$ 2,50/1M de entrada e US$ 15/1M de saída; reasoning `none` por padrão.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): saída estruturada com JSON schema estrito usada pelo provider.

A UI mostra custo relativo, sem promessa de latência/qualidade ou estimativa de preço por reunião. O catálogo não é uma consulta de modelos habilitados na conta. Acesso individual depende da conta e é informado junto ao seletor. Revalidar estas fontes ao atualizar opções; modelos de áudio, embeddings, fine-tunes e modelos deprecated não entram na lista. Os preços acima registram a consulta desta data e não constituem autorização de custo.

Não há campo livre, consulta `/models`, uso de chave real ou chamada paga. Seleção só compõe a autorização enviada no clique final; opt-in continua desmarcado e o caminho local segue independente. O contrato/provider aceitam IDs como antes: a lista é orientação da interface, não nova fronteira de segurança.

Gates: `npm run verify` passou com 750 TS (18 skipped), 12 runner, lint/formato/tipos/build. Testes UI verificam opção inicial, mudança de modelo, envio do ID selecionado e ausência de textbox. E2E offline focalizado: 3/3 aprovados (consentimento ausente, mini e GPT-5.4); transporte falso valida os IDs, zero rede real. Captura do seletor inspecionada no Electron. A suíte completa de 13 E2E havia passado na correção de layout anterior; nesta mudança foram repetidos os três cenários afetados.

## Chave via `.env` — 2026-11-12

A pedido do usuário, o main carrega `OPENAI_API_KEY` de `.env` na raiz em desenvolvimento, usando parser nativo Node e leitura limitada a 16 KiB. Uma variável válida exportada tem prioridade; cofre continua como alternativa. Builds empacotados ignoram arquivo e variável. Não há expansão de variáveis, execução de comandos nem alteração de `process.env` pelo leitor; somente a chave selecionada fica na memória do main. O renderer recebe apenas o estado `development`. Arquivo ausente/ilegível/grande ou chave inválida deixa disponíveis cofre e transcrição local.

`.env.example` e README orientam configuração/reinício. `.env` real vazio foi preparado localmente e confirmado como ignorado pelo Git; nenhuma chave real foi lida ou preenchida. Preferências e diálogo de início identificam a fonte de desenvolvimento. Consentimento para texto/custo continua separado.

Validação: `verify` com 757 TS aprovados, 18 skipped, 12 runner e lint/formato/tipos/build. Sete novos testes cobrem prioridade e captura da chave até reinício, aspas/comentário, metadados sem segredo, ausência/invalidez/tamanho e build empacotado. Novo smoke Electron usa `.env` sintético em pasta temporária e verifica metadados, ausência de segredo no renderer/localStorage/cofre, ausência de exportação ao ambiente e zero rede. Todos os fixtures agora isolam `app.getAppPath` da raiz real do usuário. Smoke completo: 15/15 aprovados. Uma repetição de verify concorrente ao smoke teve timeout de 5 s no teste de quality-gates/TypeScript; repetição completa sem concorrência passou (757 TS, 12 runner e demais gates), sem mudar timeout ou remover testes.

## Roteiro proposto para aceite real — ainda não autorizado/executado

1. Confirmar modelo OpenAI compatível, disponibilidade na conta, preço vigente e autorização de custo para **uma tentativa**, sem retry automático, com até 2.048 tokens de saída. Modelo e estimativa monetária ainda precisam ser definidos; limite de chamadas não é teto em moeda.
2. Usar ambiente silencioso e sem reunião real. Selecionar somente microfone, pt-BR, Apple Local. Autorizar captura e texto separadamente no diálogo, modelo escolhido no seletor e limite 1. Chave fica no cofre/main; não colar chave em chat/logs.
3. Falar somente: **“Qual é o prazo do projeto fictício Aurora?”**. O payload esperado contém a transcrição final dessa frase (com possíveis variações do STT), fonte `mic`, idioma e timestamps; resumo inicialmente vazio. Também contém instruções fixas do provider e schema de sugestões. Não contém áudio, imagem, IDs de sessão/segmento ou conteúdo de reunião real. Captura pode incluir som ambiente: manter silêncio fora da frase e parar se surgir conteúdo inesperado.
4. Destino da única tentativa: **POST https://api.openai.com/v1/responses**, `store: false`. Confirmar cartão válido ou silêncio deliberado sem forçar retries. Falha de autenticação/modelo consome a tentativa e exige nova decisão para repetir.
5. Desativar sugestões/parar; confirmar remoção de cartões e transcrição, indicador de captura apagado e helper encerrado. Verificar também quit/reload/restart com captura local e sugestões desativadas, sem chamadas extras, para O008. Registrar observações reais separadas das evidências sintéticas.

Não iniciar esse roteiro sem autorização explícita de captura, payload/destino e custo. T024 não pode ser DONE apenas com gates offline. A medição financeira completa continua em T025; avaliação de relevância/latência e idiomas em T026/T027.
