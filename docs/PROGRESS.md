# Estado atual e handoff

**Atualizado:** 2026-11-18. **Marco:** M11 — T063 DONE.

## Resultado T063

- `ROADMAP.md` agora mostra oito áreas evolutivas, funcionalidades, tarefas relacionadas, estado e percentuais calculados sobre escopo ativo; as 72 tarefas aparecem exatamente uma vez.
- T064–T072 transformam as descobertas em entregas para feedback de IA, permissões, resultados revisáveis, modos/atalhos do overlay, exportação, diagnóstico, atualizações e hardening do artefato.
- T032/T035 deixaram de depender de funcionalidades remotas ou visuais adiadas. T036–T039 continuam `DEFERRED`, e a sequência T056→T057→T027→T060→T061 foi preservada.
- IDs, estados, dependências, ciclos e links locais foram validados; `format:check`, `git diff --check` e os 19 testes do runner passaram. Nenhum código de produto, captura, API, custo, push ou deploy. Próxima tarefa: T056.

## Snapshot

- T053 DONE no commit `3f7ad82`, com contexto opcional e envio explícito. [Evidências T053](evidence/tasks/T053.md).
- T054 removeu o limite de dois cards reais, ampliou a resposta para até oito e a capacidade derivada da sessão para 800 (100 pedidos). A lista mostra primeiro os cards mais novos e permite rolar por toda a sessão; DEMO permanece em dois cards/30 s.
- T055 concluiu ajustes do prompt para descartar cartões sobre ruído de ASR e inferir ajuda apenas do contexto confiável. [Evidências e limites](evidence/tasks/T055.md).
- T058 agrupa fragmentos finais com debounce trailing de 2 s e permite reavaliar contexto maior após uma resposta vazia. [Evidências e limites](evidence/tasks/T058.md).
- T059 tornou executável a prioridade atual: T056→T057→T027, depois resultados estruturados ao vivo (T060) e perfis reutilizáveis (T061). Frentes secundárias ficaram `DEFERRED` e resumidas no roadmap.
- T062 moveu os relatórios de tarefa para `docs/evidence/tasks/` e reservou os diretórios de teste para testes executáveis, sem remover evidências.

## Resultado T062

- Os 19 relatórios legados agora usam `docs/evidence/tasks/Txxx.md`; README, backlog, handoff, histórico, ADRs, comentário de manutenção e links internos foram atualizados.
- A convenção está em `docs/evidence/README.md`. A verificação global não encontrou nomes antigos nem links Markdown locais quebrados; `format:check`, `git diff --check` e os 19 testes do runner passaram.
- Nenhum código de produto, teste executável, captura, API ou custo foi envolvido. Próxima tarefa: T056.

## Resultado T059

- `TASKS.md` e `ROADMAP.md` agora priorizam qualidade de áudio/STT, respostas e uso antes de ampliar funcionalidades.
- IDs, dependências e links locais foram validados; `npm run format:check` e os 19 testes do runner passaram.
- Não houve alteração de código, captura, API ou custo. Próxima tarefa: T056, remoção de eco/duplicação entre microfone e áudio do sistema.

## Resultado T058

- `npm run verify`: 886 testes TS aprovados, 18 skipped; 19 testes do runner; lint, formato, tipos e build aprovados.
- Testes focados de scheduler/contexto/provider: 109 aprovados; IPC e replay de scheduler: 21 aprovados.
- O transporte foi sintético; não foi usada chave, chamada paga, áudio ou transcrição real. A saída de um modelo em reunião ainda não foi validada e segue em T027.
- Próxima tarefa: T056; investigar eco entre o microfone e áudio do sistema na UI e no contexto para sugestões.

## Último resultado anterior: T055

- Teste focado: 59/59; `npm run verify`: 884 testes TS aprovados, 18 skipped, 19 testes do runner; lint, formato, tipos e build aprovados.
- Transporte HTTP sintético. Nenhuma chave, chamada paga, áudio ou transcrição real usado.
- Evidências e limites em [T055.md](evidence/tasks/T055.md).

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smoke: fixtures sintéticas e guardas offline em `tests/e2e/testApp.ts`.
