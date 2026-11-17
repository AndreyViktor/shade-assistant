# Estado atual e handoff

**Atualizado:** 2026-11-17. **Marco:** M10 — T059 DONE.

## Snapshot

- T053 DONE no commit `3f7ad82`, com contexto opcional e envio explícito. [Evidências T053](TEST-T053.md).
- T054 removeu o limite de dois cards reais, ampliou a resposta para até oito e a capacidade derivada da sessão para 800 (100 pedidos). A lista mostra primeiro os cards mais novos e permite rolar por toda a sessão; DEMO permanece em dois cards/30 s.
- T055 concluiu ajustes do prompt para descartar cartões sobre ruído de ASR e inferir ajuda apenas do contexto confiável. [Evidências e limites](TEST-T055.md).
- T058 agrupa fragmentos finais com debounce trailing de 2 s e permite reavaliar contexto maior após uma resposta vazia. [Evidências e limites](TEST-T058.md).
- T059 tornou executável a prioridade atual: T056→T057→T027, depois resultados estruturados ao vivo (T060) e perfis reutilizáveis (T061). Frentes secundárias ficaram `DEFERRED` e resumidas no roadmap.

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
- Evidências e limites em [TEST-T055.md](TEST-T055.md).

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smoke: fixtures sintéticas e guardas offline em `tests/e2e/testApp.ts`.
