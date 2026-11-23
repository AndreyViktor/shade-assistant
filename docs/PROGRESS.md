# Estado atual e handoff

**Atualizado:** 2026-11-23. **Marco:** M10 — T061 DONE.

## Resultado T061

- Catálogo interno fechado oferece modo sem perfil e cinco perfis com objetivo/prioridades. Preferências v4 persistem somente o ID padrão; o diálogo permite override por sessão sob o consentimento existente.
- IPC v10, core e provider transportam o perfil separado das falas. Prompt e validação impedem tratá-lo como evidência; revogação/parada limpam o estado efêmero. Política em ADR 0028.
- Recuperação auditou e preservou a árvore interrompida; corrigiu somente fronteiras de teste, tipagem e precisão do novo E2E. `verify` aprovou 943 Vitest, 19 skipped e 19 runner; smoke Electron offline aprovou 30/30, incluindo foco nativo e o novo fluxo de perfis. `git diff --check` aprovado. Evidências em [T061.md](evidence/tasks/T061.md).

## Próximo passo

- Encerrar esta sessão após o commit local T061. Selecionar no máximo uma nova tarefa elegível somente em outra sessão; nenhuma foi iniciada aqui.
