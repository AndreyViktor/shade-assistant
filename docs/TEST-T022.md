# T022 — TriggerEngine e silêncio deliberado

Data: 2026-11-11. Base: `9814226`, branch `main`, árvore inicial limpa. Dependência T021 concluída. T022 foi marcada `IN_PROGRESS` e o plano foi registrado em `PROGRESS.md` antes da edição de código/testes.

## Entrega e política

- `src/core/suggestions/TriggerEngine.ts`: classificador local, determinístico e sem estado; usa eventos de transcrição já validados pelo contrato existente, ou comandos internos `manual`/`silence`.
- Resultados: `question`, `objection`, `commitment`, `manual`, `none`. Apenas falas finais em `pt-BR` participam da classificação automática. Parcial, ready/status/error/stopped, silêncio e locale não suportado resultam em `none`.
- Perguntas diretas, pedidos de explicação, objeções/impedimentos, informação necessária ausente e compromissos/prazos explícitos usam padrões de texto locais. Normalização trata caixa, acentos Unicode e espaços; a pontuação interrogativa não é obrigatória nem suficiente. Saudações e perguntas triviais previstas são ignoradas por oração.
- Uma decisão por evento: pergunta tem precedência sobre objeção, que tem precedência sobre compromisso. O comando manual retorna `manual` mesmo sem fala/contexto. Um gatilho não confirma um compromisso como fato nem obriga o provider a produzir cartões.
- Nenhuma consulta de histórico, timer, chamada de rede, captura, log de fala ou inferência de identidade a partir de `mic`/`system`. Não há alteração de contrato público, IPC, provider, UI ou fronteira arquitetural; ADR novo não necessário.

## Evidências automatizadas

| Verificação                                                                                                                                     | Resultado                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm test -- src/core/suggestions/TriggerEngine.test.ts tests/integration/triggerPipeline.test.ts` | 2 arquivos, 77 testes aprovados (76 unitários + 1 replay integrado).                                                                                      |
| `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`                                                                                   | Exit 0: lint sem warnings, formato, três tsconfigs, 691 testes TS aprovados, 18 skipped preexistentes, 12 testes do runner e build main/preload/renderer. |
| `git diff --check`                                                                                                                              | Sem erros de whitespace.                                                                                                                                  |

Casos unitários: perguntas com/sem `?`, pedido de opinião/esclarecimento, objeção/risco, tarefa/prazo, comando manual sem contexto e após classificações automáticas, precedência, normalização Unicode, ausência de mutação e equivalência das fontes. Negativos incluem conversa trivial, ruído, apenas pontuação, fragmentos, menção isolada a palavras-chave, risco resolvido/negado, tarefa negada/hipotética, fala relatada, mudança para assunto trivial e locale `en-US`. Hipóteses parciais de pergunta/objeção/compromisso ficam silenciosas; a fala final reconciliada determina a classificação. Cem eventos de silêncio após uma pergunta continuam retornando `none`.

O replay integrado usa somente dados sintéticos e `MockSuggestionProvider`. Exercita protocolo validado → `ContextManager` → `TriggerEngine` → provider: uma parcial é substituída por uma fala final trivial, os três tipos automáticos disparam avaliação, falas triviais não chamam o provider, e perguntas arquivadas no resumo não voltam a disparar durante silêncio. O comando manual funciona com contexto vazio e com resumo; o mock retorna zero cartões em todas as avaliações. Essa composição existe no teste, não no ciclo real do app.

## Limites e handoff

- Aceite sintético de T022 comprovado; não houve captura, uso de credenciais ou API paga. Swift e E2E de UI não foram reexecutados: a mudança está restrita ao core e a testes/documentação, sem alteração de código nativo, sessão ou interface.
- Heurísticas pt-BR cobrem os casos documentados, não interpretação semântica geral. Formulações indiretas, retóricas, citações, nomes antes da pergunta e falas compostas podem gerar falsos positivos/negativos. Não houve avaliação humana de relevância, medição representativa de precisão/latência nem comprovação de suporte bilíngue. Não se afirma percentual de cobertura instrumentada.
- O chamador deve entregar somente eventos novos, validados e da sessão ativa; a classificação não concede autorização de envio. Consentimento, estado da sessão e orçamento continuam sob responsabilidade do host.
- Dedup/debounce/cooldown/expiração/invalidação são T023. Eventos repetidos ainda têm a mesma classificação; esse módulo não suprime repetições. Conexão efetiva ao app, autorização e publicação de cartões são T024; a tarefa atual não muda o comportamento visível do overlay.

T022 encerrada após os gates e o registro de aceite; próxima tarefa somente em nova sessão.
