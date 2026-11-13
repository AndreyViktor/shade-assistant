# Estado atual e handoff

**Atualizado:** 2026-11-12. **Marco:** M3 — integração de sugestões implementada; aceite real pendente.

## Planejamento de usabilidade — 2026-11-12

O usuário informou que, após adicionar créditos, uma frase transcrita gerou dois cartões reais. Isso valida o caminho básico transcrição → OpenAI → cartões, mas não todos os critérios de T024. Também observou que 30 s é pouco, cartões e histórico competem pela mesma coluna e configurações precisam de tela própria.

A implementação foi iniciada por interpretação equivocada durante uma conversa de planejamento. A pedido do usuário, o código foi restaurado ao último commit, sem executar testes sobre o rascunho; o diff está em `/private/tmp/meeting-copilot-layout-interrompido.patch` como referência temporária, não validada. Nenhuma chave, transcrição ou captura real foi lida pelo agente. Planejamento registrado em T040–T043: retenção dos cartões, layout lado a lado, configurações e organização da DEMO/validação. Executar uma tarefa por sessão. T024 permanece BLOCKED pelos critérios de aceite ainda não comprovados.

## Avaliação contínua T024

Após relato de 20 minutos sem gatilhos, trechos finais autorizados são agrupados e avaliados automaticamente; apenas uma chamada fica ativa e falas novas atualizam o contexto pendente. Debounce de 500 ms, intervalo mínimo de 10 s e limite inicial configurável de 10 tentativas. Revogação, limite, expiração e deduplicação preservados. Testes sintéticos e smoke offline concluídos; ensaio real permanece pendente. Ver [ADR 0021](adr/0021-continuous-suggestion-evaluation.md).

## Snapshot

- T001–T015 e T017–T023 concluídas. T024 está `BLOCKED` somente pelo ensaio real. T016 e T036–T039 continuam `DEFERRED`; estados completos em [TASKS.md](TASKS.md).
- T024 conecta Apple Local → contexto → avaliação contínua/scheduler → provider OpenAI → cartões e diagnóstico IPC v5. Envio de texto desmarcado por padrão, modelo explícito e limite inicial de dez tentativas. Revogação preserva a transcrição local; DEMO offline.
- Configuração atual: início local sem campos OpenAI, sugestões opcionais, seletor GPT-5.4 mini/GPT-5.4; chave via `.env`/variável exportada somente no main em desenvolvimento, ou importação no cofre. Alterações da chave de desenvolvimento exigem reiniciar.
- Gates atuais: `verify` com 784 TS aprovados, 18 skipped, 12 runner e lint/formato/tipos/build; smoke Electron completo 17/17. Helper, chave e transporte sintéticos; rede bloqueada. Os gates foram executados com fixtures; o usuário relatou separadamente uma chamada real bem-sucedida. O agente não acessou chave ou reunião real.

## Diagnóstico OpenAI — entrega atual

Plano executado: snapshot validado/versionado com estágio, gatilho, modelo, tentativas, corpo exato da última requisição sem headers, HTTP, duração e resultado seguro. **Estado da OpenAI → Diagnóstico OpenAI** explica também sugestões desligadas, espera por fala final, resposta vazia e cancelamento; a classificação local é apenas informativa. Abrir o painel não faz chamada ou retry. A última tentativa em andamento tem prioridade visual sobre limite esgotado.

Somente a última tentativa fica em memória. Pausa limpa o corpo; parada/revogação/nova sessão/reload limpam tudo. Callbacks antigos não repovoam os dados. Testes cobrem igualdade do corpo com o transporte, sucesso/vazio/401, erros de rede, ausência de segredos/erros brutos, validação, cancelamento e limpeza. Captura sintética do painel/JSON inspecionada no Electron.

Evidências e roteiro em [TEST-T024.md](TEST-T024.md). Composição em [ADR 0019](adr/0019-live-suggestion-session.md); diagnóstico e migração IPC v5 em [ADR 0020](adr/0020-suggestion-diagnostics.md). Correções anteriores de UX, modelos e `.env` estão documentadas no teste especializado.

## Bloqueio e próximo passo

O usuário relatou um ensaio real básico bem-sucedido, sem evidência dos demais critérios de T024. O lote irrestrito anterior foi rejeitado pela revisão automática por possível envio de texto de reunião; autorização para novos ensaios pelo agente deve ser explícita quanto a captura, conteúdo e custo.

Para o ensaio assistido: confirmar modelo/acesso/preço e autorização de captura e uma tentativa paga, enviando somente a frase fictícia e destino definidos em TEST-T024.md. Para observar o próprio teste no app, reiniciar com a versão atual, iniciar sessão pt-BR com sugestões autorizadas, abrir diagnóstico, falar a frase e aguardar o final/HTTP/resultado. Falhas contam no limite (dez por padrão); após esgotá-lo, parar e iniciar outra sessão autorizada antes de repetir. Não marcar DONE nem avançar runner automaticamente antes do aceite real.

O008: shutdown/restart testados com mocks; encerramento físico de captura/helper e falhas do SO ainda dependem de ensaio. Cancelamento após envio não garante ausência de custo. Medição financeira permanece T025; avaliação de qualidade/latência em T027. Windows/fallback remoto não foram reativados.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smoke Electron requer execução fora do sandbox; aprovado com perfil temporário e rede bloqueada. Não executar verify concorrentemente ao smoke: houve timeout isolado do quality gate TypeScript na sessão anterior, resolvido em execução sequencial.
- Runner original não mudou. `BLOCKED` impede próximo ciclo; implementação offline não equivale ao aceite real.
