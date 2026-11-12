# Estado atual e handoff

**Atualizado:** 2026-11-12. **Marco:** M3 — integração de sugestões implementada; aceite real pendente.

## Snapshot

- T001–T015 e T017–T023 concluídas. T024 está `BLOCKED` apenas pelo ensaio real; seletor de modelos e correções de UX implementados em 12/11. T016 e T036–T039 continuam `DEFERRED`; estados completos em [TASKS.md](TASKS.md).
- T023 concluída no commit `59527e7`: agendamento, dedup e invalidação de sugestões.
- T024 conecta eventos Apple Local → contexto → gatilhos/scheduler → provider OpenAI → cartões IPC v4/overlay. Envio de texto desmarcado por padrão, modelo explícito e limite inicial de uma tentativa; revogação preserva a transcrição local. DEMO offline.
- Gates T024 atuais: 750 TS, 12 runner e 3/3 E2E afetados passaram; suíte completa anterior 13/13; 18 TS skipped. Evidências em [TEST-T024.md](TEST-T024.md), decisão técnica no [ADR 0019](adr/0019-live-suggestion-session.md). Sem captura real, chave real ou chamada paga nesta execução.

## Correção de UX — 2026-11-12

Início local simples, sem campos OpenAI obrigatórios. Sugestões opcionais abrem configuração com estado/importação segura da chave, explicação de modelo e limite; há ação para seguir só com a transcrição. Layout/rolagem/foco do diálogo revisados; Preferências atualiza metadados sem perder rascunho. Evidências em [TEST-T024.md](TEST-T024.md).

`verify`: 749 TS aprovados, 18 skipped, 12 runner e gates/build. Smoke Electron: 13/13 aprovados. A correção não autoriza captura/API nem conclui o aceite real.

## Seletor de modelos — 2026-11-12

Campo livre substituído por lista local: GPT-5.4 mini (inicial, menor custo) e GPT-5.4 (tarefas complexas). Descrição muda com a seleção; fontes oficiais e compatibilidade documentadas em TEST-T024.md. Lista não consulta conta/chave/API nem concede consentimento. Transcrição local não depende da escolha.

`verify`: 750 TS, 18 skipped, 12 runner e gates/build. E2E focalizado: 3/3 (sem consentimento, mini, GPT-5.4), transporte sintético e rede bloqueada. Não houve ensaio pago; manter BLOCKED por esse aceite.

## Bloqueio e próximo passo

T024 requer ensaio Mac/OpenAI real autorizado. Revisão automática rejeitou o lote irrestrito por possível envio de texto de reunião; execução posterior foi aprovada somente para implementação/testes offline. O usuário pediu continuar após a sessão filha atingir limite de uso; os gates e a documentação foram finalizados na sessão principal.

Antes do ensaio: confirmar modelo/acesso/preço e autorização de captura e de uma tentativa paga, enviando somente a frase fictícia definida em [TEST-T024.md](TEST-T024.md) a `https://api.openai.com/v1/responses`. Limite de tentativas não é teto monetário; medição completa fica em T025. Não marcar DONE nem avançar o runner automaticamente antes de resolver esse bloqueio.

O008: coordenação de shutdown/restart foi implementada e testada com mocks; encerramento real de captura/helper e falhas de SO ainda precisam de ensaio. Windows e fallback remoto não foram reativados.

## Ambiente

- Usar Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Electron E2E falhou no launch sob sandbox; `npm run test:smoke` com escalada aprovada passou com perfil temporário, rede bloqueada e fixtures sintéticos.
- O runner original não mudou. A execução T024 interrompida saiu com erro; o estado `BLOCKED` impede próximo ciclo. Não confundir implementação offline com aceite real.
