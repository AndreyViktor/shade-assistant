# Estado atual e handoff

**Atualizado:** 2026-11-12. **Marco:** M7 — T041 bloqueada no aceite nativo/manual.

## Snapshot

- Somente T041 trabalhada; dependências T040/T017 concluídas. T041 `BLOCKED`, não `DONE`; T042 não iniciada.
- Plano registrado antes da implementação: colunas de transcrição/cartões, rolagem/foco, janela flutuante em Spaces, política sem descarte por resize, gates offline e ensaio manual no Mac. Fatia implementada: janela 960×720 (mínimo 640×480), histórico por fonte, colunas com rolagem própria, dois cartões preservados em resize e configuração macOS de todos os Spaces/tela cheia.
- `verify` passou: 808 TS, 18 skipped, 19 runner, lint/formato/tipos/build. Smoke completo 17/19; corrida de rolagem do teste corrigida e dois cenários de layout passaram depois. Gate de foco nativo continua falhando; não foi removido. Evidências visuais sintéticas, comandos, limites e critérios em [TEST-T041.md](TEST-T041.md).
- `isFocused()` também retornou falso em janela Electron padrão sem configuração de Spaces. Apenas um display observado; troca real de Spaces, outro app em tela cheia, múltiplos monitores e arraste humano não foram validados. Getters de janela e foco DOM não comprovam isso.

## Próximo passo

Retomar exclusivamente T041 em nova sessão gráfica interativa, com dois monitores: reproduzir/resolver o gate de foco nativo, repetir smoke e executar o roteiro manual de [TEST-T041.md](TEST-T041.md). Só marcar DONE após evidência de aceite. Sessão atual encerra após commit local da implementação parcial e bloqueio; não avançar T042.

## Ambiente e limites

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smokes Electron exigem escalada revisada; usam perfis temporários, fixtures sintéticas e rede bloqueada. Nenhuma captura, API real, credencial real ou custo nesta sessão. Swift não alterado.
- Git add/commit autorizado por escalada revisada; sem push/deploy. Windows e STT remoto continuam adiados.
