# Estado atual e handoff

**Atualizado:** 2026-11-13. **Marco:** M7 — T041 concluída com aceite em um monitor; T042 é a próxima.

## Snapshot

- T040 DONE: cartões reais sem expiração por tempo; até dois, limpeza ao pausar/parar/revogar. Evidências em [TEST-T040.md](TEST-T040.md).
- T041 DONE: painel com histórico e cartões em colunas e janela configurada para Spaces/tela cheia. `verify`: 808 TS, 18 skipped, 19 runner; smoke Electron 19/19 na retomada. Foco nativo falhou anteriormente, mas passou na repetição; causa anterior não identificada. Usuário confirmou ensaio com um monitor e aceitou adiar o ensaio de dois monitores a T045 (D020). [TEST-T041.md](TEST-T041.md).
- T042 e T043 permanecem TODO. T045 registra validação futura com dois monitores; não se afirma que ocorreu. T016 e T036–T039 continuam DEFERRED.

## Próximo passo

O usuário pediu executar a sprint M7 e confirmou avançar após aceite da T041. Retomar pelo runner com `python3 scripts/run-codex-tasks.py --tasks T042 T043`, que cria sessões separadas e para em bloqueios; verificar estado e commits ao fim. T045 não entra neste lote. Respeitar limites de credenciais, captura e custos; testes devem usar fixtures e rede bloqueada, salvo autorização explícita adicional.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smoke Electron com escalada revisada, perfis temporários e rede bloqueada; sem push ou deploy.
