# Estado atual e handoff

**Atualizado:** 2026-11-13. **Marco:** M7 concluído; próximo passo M8 — layout compacto.

## Snapshot

- T040 DONE: cartões reais sem TTL, capacidade dois, limpeza na pausa; [TEST-T040.md](TEST-T040.md).
- T041 DONE com aceite do usuário em um monitor; dois monitores adiados para T045. O foco nativo e smoke 19/19 passaram na retomada; [TEST-T041.md](TEST-T041.md).
- T042 DONE: configurações em tela própria, modelo persistido, migração v1 e consentimento por sessão; verify 820 TS e 19 runner, smoke inicial 18/20 e reteste dos dois casos 2/2. Commit `e6b498a`; [TEST-T042.md](TEST-T042.md).
- T043 DONE: DEMO em Preferências/Diagnóstico. Verify passou (822 TS, 18 skipped, 19 runner, lint/formato/tipos/build); smoke gráfico 19/21 e reteste dos dois 2/2, após corrigir prazo de espera. Causa da outra falha não identificada. Screenshots inspecionados; imagem com zoom recortada, revisão integrada em T048. [TEST-T043.md](TEST-T043.md).

## Próximo passo

Executar T046, T047 e T048 pelo runner em sessões separadas, conforme plano aprovado; T049–T050 e T045 permanecem futuros. A imagem recortada em zoom e a falha transitória de smoke da T043 devem ser consideradas na revisão integrada, sem pressupor causa identificada.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- O agente não fez captura real, usou credenciais pessoais, enviou texto à API, autorizou custos, fez push ou deploy.
