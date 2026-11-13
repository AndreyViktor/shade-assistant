# Estado atual e handoff

**Atualizado:** 2026-11-13. **Marco:** M7 — T041 bloqueada no aceite nativo/manual.

## Snapshot

- Somente T041 trabalhada; dependências T040/T017 concluídas. T041 `BLOCKED`, não `DONE`; T042 não iniciada.
- Plano registrado antes da implementação: colunas de transcrição/cartões, rolagem/foco, janela flutuante em Spaces, política sem descarte por resize, gates offline e ensaio manual no Mac. Fatia implementada: janela 960×720 (mínimo 640×480), histórico por fonte, colunas com rolagem própria, dois cartões preservados em resize e configuração macOS de todos os Spaces/tela cheia.
- `verify` passou: 808 TS, 18 skipped, 19 runner, lint/formato/tipos/build. Retomada 13/11: o teste de foco nativo passou (1/1) e o smoke completo passou (19/19). A causa da falha anterior não foi identificada; o gate não foi removido. Evidências visuais sintéticas, comandos, limites e critérios em [TEST-T041.md](TEST-T041.md).
- Na execução anterior, `isFocused()` também retornou falso em janela Electron padrão sem configuração de Spaces, mas passou na retomada. Apenas um display observado; troca real de Spaces, outro app em tela cheia, múltiplos monitores e arraste humano não foram validados. Getters de janela e foco DOM não comprovam isso.

## Próximo passo

Retomar exclusivamente T041 em nova sessão gráfica interativa, com dois monitores: executar o roteiro manual de [TEST-T041.md](TEST-T041.md). Só marcar DONE após evidência de aceite. Retomada atual registra gates passados e mantém bloqueio pelo ensaio manual; não avançar T042.

## Ambiente e limites

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smokes Electron exigem escalada revisada; usam perfis temporários, fixtures sintéticas e rede bloqueada. Nenhuma captura, API real, credencial real ou custo nesta sessão. Swift não alterado.
- Git add/commit autorizado por escalada revisada; sem push/deploy. Windows e STT remoto continuam adiados.
