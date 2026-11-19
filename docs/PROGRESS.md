# Estado atual e handoff

**Atualizado:** 2026-11-19. **Marco:** M10 — T056 DONE.

## Resultado T056

- A política compartilhada agora compara finais `mic` com até quatro finais consecutivos e temporalmente sobrepostos de `system`, usando palavras em ordem e cobertura do trecho removido. `system` continua representante; parciais, texto reordenado, fala adicional distinta e eventos sem suporte temporal permanecem.
- O ensaio físico autorizado reproduziu a frase sintética nos alto-falantes e obteve `mic=1`, `system=1`, `rawFinals=2`, `localFinals=1` e `contextFinals=1`. A saída trouxe somente contagens, tempos e número de palavras; não houve texto transcrito, OpenAI ou rede.
- Testes focados: 72/72. `verify:swift`: 50 testes e build release. `npm run verify`: lint, formato, três typechecks, 904 testes TypeScript aprovados (18 skipped), 19 testes do runner e os builds main/preload/renderer. `git diff --check` aprovado.

## Handoff e limites

- T056 está concluída para o cenário comprovado. A solução é supressão textual pós-STT, não cancelamento acústico; diferenças maiores de timing/texto ou segmentação podem preservar duplicatas, e falas muito parecidas/sincronizadas podem ser agrupadas.
- Nenhuma outra tarefa foi iniciada. Encerrar esta sessão após o commit local T056, sem push ou deploy.
