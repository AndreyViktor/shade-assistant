# Estado atual e handoff

**Atualizado:** 2026-11-19. **Marco:** M11 — T073 DONE.

## Resultado T073

- `Progresso ativo` passou para a segunda coluna do painel geral de [ROADMAP.md](ROADMAP.md).
- Escopo ativo agora significa `DONE` + `TODO` + `IN_PROGRESS` + `BLOCKED`; `IN_PROGRESS` sozinho identifica execução corrente, e `DEFERRED` fica fora do denominador.
- O painel foi recalculado para 41 `DONE`, 18 ativas não concluídas, 14 `DEFERRED` e 69% no total ativo.
- As 73 tarefas permanecem mapeadas. `format:check`, `git diff --check` e 19 testes do runner passaram; nenhum código, prioridade de produto, captura, rede ou custo mudou.

## Handoff

- T056 foi reaberta (`IN_PROGRESS`) após relato de finais duplicados ao usar alto-falantes externos com `mic + system`. A evidência anterior de T056 continua válida para o cenário ensaiado, mas não cobre esta reprodução.
- Plano em [TASKS.md](TASKS.md): ampliar a supressão textual pós-STT, preservar falas distintas e parciais, e exigir ensaio Mac autorizado com fala sintética e contagens sem conteúdo antes de concluir. Nenhum código ou teste físico foi executado nesta atualização documental.
- T057 continua não iniciada e não elegível enquanto sua dependência T056 estiver `IN_PROGRESS`.
- O `.env` ausente é estado local esperado: o caminho é ignorado e nunca foi rastreado/removido em commit. Para sugestões, importar a chave em Preferências → Chave OpenAI; a sessão ainda exige autorização explícita. Não há chave para usar na sessão atual.
