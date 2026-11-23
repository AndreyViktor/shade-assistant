# Estado atual e handoff

**Atualizado:** 2026-11-23. **Marco:** T067 DONE.

## Resultado parcial T067

- Os cinco modos efêmeros foram implementados no renderer, sem IPC/persistência; o modo oculto mantém indicador de captura, restauração focada e aviso explícito de que a janela pode aparecer em compartilhamentos.
- Typecheck, lint, formato, build, 13 testes React focados e smoke Electron offline 1/1 passaram. O smoke foi executado fora do sandbox após autorização explícita do usuário.
- `npm run verify` passou: lint, formato, typecheck, 962 Vitest (19 skipped), 19 testes do runner e build. Smoke Electron offline 1/1; `git diff --check` limpo.
- Evidência e limites em [T067](evidence/tasks/T067.md). A exceção fora do sandbox foi autorizada pelo usuário somente para o smoke offline.

## Próximo passo

- Encerrar a sessão após o commit local T067; nenhuma outra tarefa foi iniciada.
