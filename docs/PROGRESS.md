# Estado atual e handoff

**Atualizado:** 2026-11-13. **Marco:** M8 — T046 concluída; próxima T047.

## Snapshot

- T041 e T043 DONE; T041 aceita em um monitor, dois monitores permanecem em T045. [TEST-T041.md](TEST-T041.md), [TEST-T043.md](TEST-T043.md).
- T046 DONE: painel compacto com transcrição e sugestões lado a lado e falhas por área; usuário confirmou avaliação visual. Verify passou (848 TS, 18 skipped, 19 runner, lint/formato/tipos/build). Smoke Electron inicial 18/23, reteste 7/7 dos arquivos afetados após ajustes nos testes; imagens sintéticas inspecionadas. Detalhes e limites em [TEST-T046.md](TEST-T046.md).
- Fonte de áudio ainda está no painel e deve ser movida e persistida em T047. Usuário pediu controles separados para transcrição e sugestões, registrados em T051.

## Próximo passo

Executar T047 e T048 pelo runner em sessões separadas. Verificar visibilidade de Preferências na sessão ativa e dimensões/zoom na revisão integrada. T045, T049 e T050 permanecem futuros.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Testes com perfil temporário, fixtures sintéticas e rede bloqueada; sem captura real, credenciais pessoais, envio à API, custos, push ou deploy.
