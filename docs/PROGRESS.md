# Estado atual e handoff

**Atualizado:** 2026-11-13. **Marco:** M8 — T047 concluída; próxima T048.

## Snapshot

- T046 DONE: painel compacto, validado pelo usuário e por testes offline. [TEST-T046.md](TEST-T046.md).
- T047 DONE: quatro seções de Preferências; fonte persistida, migração v1/v2 e aplicação na próxima sessão, sem interromper a atual. Um problema de Escape após salvar foi corrigido. Verify passou (866 TS, 18 skipped, 19 runner, lint/formato/tipos/build); smoke Electron offline 24/24. Imagens inspecionadas. [TEST-T047.md](TEST-T047.md), [ADR 0024](adr/0024-audio-source-preference-v3.md).
- Controles separados de transcrição e sugestões registrados em T051; T045, T049 e T050 permanecem futuros.

## Próximo passo

Executar T048 pelo runner em sessão separada: revisão integrada da navegação, acessibilidade, erros, sessão ativa, dimensões e zoom, com fixtures e rede bloqueada. Verificar visibilidade de Preferências em sessão ativa e considerar a imagem de zoom parcial registrada em T047.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Testes com perfil temporário, fixtures sintéticas e rede bloqueada; sem captura real, credenciais pessoais, envio à API, custos, push ou deploy.
