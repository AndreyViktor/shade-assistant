# Estado atual e handoff

**Atualizado:** 2026-11-12. **Marco:** M3 — T024 concluída após aceite manual informado pelo usuário; M7 planejada.

## Snapshot

- T001–T015 e T017–T024 concluídas; T016 e T036–T039 `DEFERRED`. T044 concluída. Estados em [TASKS.md](TASKS.md).
- T024: o usuário relatou dois cartões reais e confirmou transcrição sem sugestões, pausa/retomada, revogação, parada e fechamento/reabertura com limpeza e sem captura/helper residuais nos cenários apresentados. Registro em [TEST-T024.md](TEST-T024.md) e D019; o agente não capturou áudio nem usou chave/API real.
- Gates: `verify` com 784 TS aprovados, 18 skipped, 19 runner, lint/formato/tipos/build; smoke Electron 17/17 com fixtures e rede bloqueada. Falhas de SO não foram especificamente validadas (O008/T032); custo, relevância e latência permanecem T025/T027.

## M7 — próxima sequência planejada

T040 retenção dos cartões → T041 layout com chat e cartões lado a lado, janela flutuante e validação de Spaces/tela cheia → T042 configurações escondidas durante uso, abertas sob demanda → T043 DEMO secundária e validação. Uma tarefa por sessão; detalhes e critérios em [TASKS.md](TASKS.md). O usuário autorizou planejamento e, antes de executar M7, pediu confirmar T024; não iniciar M7 sem pedido de execução.

`python3 scripts/run-codex-tasks.py --tasks T040 T041 T042 T043 --dry-run` pré-valida a lista; sem `--dry-run` executa apenas esses IDs em ordem e em sessões separadas, respeitando dependências e bloqueios. Começar preferencialmente com `--max-tasks 1`. T044 e testes em [TEST-T044.md](TEST-T044.md).

Rascunho de código iniciado durante planejamento foi restaurado; diff temporário não validado em `/private/tmp/meeting-copilot-layout-interrompido.patch`. Nenhum segredo ou conteúdo de reunião foi lido pelo agente.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smoke Electron requer execução fora do sandbox; aprovado com perfil temporário e rede bloqueada. Novas capturas, uso de credenciais ou custos pelo agente exigem autorização explícita.
- Sem push automático. Windows e STT remoto continuam adiados.
