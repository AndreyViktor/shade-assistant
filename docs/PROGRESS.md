# Estado atual e handoff

**Atualizado:** 2026-11-15. **Marco:** M9 — T054 DONE.

## Snapshot

- T053 DONE no commit `3f7ad82`, com contexto opcional e envio explícito. [Evidências T053](TEST-T053.md).
- T054 removeu o limite de dois cards reais, ampliou a resposta para até oito e a capacidade derivada da sessão para 800 (100 pedidos). A lista mostra primeiro os cards mais novos e permite rolar por toda a sessão; DEMO permanece em dois cards/30 s.
- IPC de sessão migrou para v8. Deduplicação, descarte explícito, limpeza do ciclo da sessão e limite de pedidos permanecem.

## Resultado T054

- `npm run verify`: 884 testes aprovados, 18 skipped; 19 testes do runner; lint, formato, tipos e build aprovados.
- Smoke Electron offline focado: 2/2. Oito cards, ordem, rolagem por teclado, resize/zoom, descarte e limpeza validados com fixtures sintéticas. Imagens de 960×720 e 640×480 inspecionadas.
- Evidências em [TEST-T054.md](TEST-T054.md); decisão em [ADR 0026](adr/0026-all-live-suggestion-cards.md).
- Sem captura real, chave do usuário, chamada paga ou envio de rede. A pausa continua limpando os cards conforme a política existente. Sem push.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smoke: fixtures sintéticas e guardas offline em `tests/e2e/testApp.ts`.
