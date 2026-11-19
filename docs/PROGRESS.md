# Estado atual e handoff

**Atualizado:** 2026-11-19. **Marco:** M11 — T073 DONE.

## Resultado T073

- `Progresso ativo` passou para a segunda coluna do painel geral de [ROADMAP.md](ROADMAP.md).
- Escopo ativo agora significa `DONE` + `TODO` + `IN_PROGRESS` + `BLOCKED`; `IN_PROGRESS` sozinho identifica execução corrente, e `DEFERRED` fica fora do denominador.
- O painel foi recalculado para 41 `DONE`, 18 ativas não concluídas, 14 `DEFERRED` e 69% no total ativo.
- As 73 tarefas permanecem mapeadas. `format:check`, `git diff --check` e 19 testes do runner passaram; nenhum código, prioridade de produto, captura, rede ou custo mudou.

## Handoff

- T058 é a tarefa corrente (`IN_PROGRESS`). A inspeção confirmou que o debounce do scheduler é 2 s após a última fala final, enquanto o diagnóstico exibe 0,5 s; ambos referem-se à mesma espera, mas a interface está desatualizada. O período é temporal, não uma verificação de contexto suficiente.
- A chamada automática é submetida após cada fala final, mesmo quando o `TriggerEngine` retorna `none`; o contexto de até quatro minutos limita o que pode ser enviado, mas não faz o app esperar por esse contexto. T058 e T027 foram ampliadas para registrar política geral de prontidão e avaliação de valor incremental, sem regras por exemplo.
- T056 foi pausada em `TODO` para priorizar T058. T057 continua não iniciada e depende da conclusão de T056; T027 permanece `TODO` e depende de T057/T058.
- Esta atualização foi documental: nenhum código, teste de áudio físico ou chamada OpenAI foi executado.
