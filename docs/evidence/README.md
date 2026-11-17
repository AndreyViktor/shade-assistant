# Evidências

Esta pasta guarda evidências duráveis que complementam os critérios de aceite do backlog:

- `tasks/Txxx.md`: relatório de implementação, gates, validação manual e limites de uma tarefa;
- `Txxx/`: imagens ou outros artefatos vinculados ao relatório da tarefa;
- arquivos de dados diretamente nesta pasta: resultados estruturados de ensaios específicos.

Esses relatórios não são testes executáveis. Testes automatizados permanecem em `tests/`, `src/**/*.test.*` e `native/macos/Tests/`. Novos relatórios devem usar o ID da tarefa sem o prefixo `TEST-` e ser ligados por `docs/TASKS.md`.
