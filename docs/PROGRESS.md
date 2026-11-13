# Estado atual e handoff

**Atualizado:** 2026-11-12. **Marco:** M7 — T040 concluída.

## Snapshot

- T001–T015 e T017–T024 concluídas; T040 e T044 concluídas. T016 e T036–T039 `DEFERRED`. Estados/aceites em [TASKS.md](TASKS.md).
- T024 permanece validada pelo relato do usuário (D019); evidências e limites em [TEST-T024.md](TEST-T024.md). Falhas excepcionais de SO seguem O008/T032.
- T040: cartões reais sem expiração por tempo, dois mais recentes e descarte explícito. Dedup limitada a 100 inserções; pausa limpa cartões/supressão, retomada não restaura; stop/revogação/restart limpam. DEMO mantém TTL de 30 s. IPC de sessão agora v6. Política em [ADR 0022](adr/0022-retained-live-suggestions.md).
- Gates T040: verify aprovado (805 TS, 18 skipped, 19 runner, lint/formato/tipos/build); smoke Electron offline 17/17. Evidências em [TEST-T040.md](TEST-T040.md). Sem captura, API real ou custos; Swift não alterado.

## Próximo passo

Sessão T040 encerrada após commit local; nenhum bloqueio de aceite. Próxima tarefa elegível: **T041, em nova sessão**, para layout lado a lado e validação de janela/Spaces/tela cheia. T042/T043 continuam dependentes dessa sequência. Não houve implementação dessas tarefas nesta sessão.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smoke Electron exige execução fora do sandbox; T040 aprovado com perfil temporário, fixtures sintéticas e rede bloqueada. Captura, credenciais reais e custos exigem autorização explícita.
- Git protegido: add/commit locais usam escalada revisada. Sem push automático. Windows e STT remoto continuam adiados.
