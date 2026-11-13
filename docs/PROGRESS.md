# Estado atual e handoff

**Atualizado:** 2026-11-13. **Marco:** M7 — T043 bloqueada na validação Electron.

## Snapshot

- T040 DONE: cartões reais sem TTL, capacidade dois, limpeza na pausa; [TEST-T040.md](TEST-T040.md).
- T041 DONE com aceite do usuário em um monitor; dois monitores adiados para T045. O foco nativo e smoke 19/19 passaram na retomada; [TEST-T041.md](TEST-T041.md).
- T042 DONE: configurações em tela própria, modelo persistido, migração v1 e consentimento por sessão; verify 820 TS e 19 runner, smoke inicial 18/20 e reteste dos dois casos 2/2. Commit `e6b498a`; [TEST-T042.md](TEST-T042.md).
- T043 BLOCKED: implementação provisória move DEMO para Preferências/Diagnóstico, compartilha estado e mantém rótulo/controles de simulação. `verify` passou (822 TS, 18 skipped, 19 runner, lint/formato/tipos/build). A sessão filha atingiu limite de uso após a revisão automática rejeitar a escalada do smoke por entendê-la incompatível com a restrição de sandbox informada à sessão. Tentativa sem escalada: Electron não iniciou, 21 casos sem execução efetiva. Ainda faltam smoke completo e screenshots inspecionados; não marcar DONE. Evidências em [TEST-T043.md](TEST-T043.md).

## Próximo passo

Revisar a recusa de escalada e obter autorização efetiva para o smoke Electron offline, com perfil temporário, fixtures sintéticas e guardas de rede/captura; não contornar a revisão. Executar smoke, corrigir falhas e inspecionar evidências visuais antes de avaliar DONE. T045 permanece futura; não executar como parte da lista original T040–T043.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- O agente não fez captura real, usou credenciais pessoais, enviou texto à API, autorizou custos, fez push ou deploy.
