# Estado atual e handoff

**Atualizado:** 2026-11-24. **Marco:** T065 DONE para uso local.

## Resultado T065

- Contrato/IPC/UI e modo `--readiness` sem captura do helper foram implementados; `verify:swift` passou (59 testes e build) e `npm run verify` final passou (985 Vitest, 20 skipped; 19 runner; lint/formato/tipos/build).
- Bundle helper com assinatura ad hoc passou 17 testes de processo; smoke Electron offline da interface e IPC passou 1/1 com helper sintético e rede bloqueada.
- Probe real sem captura retornou helper permitido, assinatura ad hoc, microfone/Speech negados e screen capture ambíguo/negado; nenhum prompt ou captura foi iniciado.
- O usuário aceitou o escopo local e transferiu a T034 os ensaios em Mac limpo e após mudança real de assinatura/TCC, antes da entrega do pacote a desenvolvedores confiáveis. Evidências em [T065](evidence/tasks/T065.md); decisão D022.

## Próximo passo

- Encerrar T065 após o commit local. Em T034, executar os dois ensaios de TCC antes da entrega do pacote.
