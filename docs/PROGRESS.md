# Estado atual e handoff

**Atualizado:** 2026-11-13. **Marco:** M7 — T042 concluída nesta sessão exclusiva.

## Snapshot

- T042 DONE: tela exclusiva de preferências com retorno/foco acessível e sessão preservada. Idioma/modelo salvos para o próximo início; Apple Local para transcrição, OpenAI para sugestões; STT remoto indisponível. Preferências v2 migram v1; importação segura/cofre/.env mantidos. Consentimento e limite continuam por sessão.
- Gates: verify aprovado (820 TS, 18 skipped, 19 runner, lint/formato/tipos/build). Smoke inicial 18/20; após corrigir espera de carregamento e seletor nos testes, reteste 2/2 aprovado. Todos os 20 cenários cobertos entre execuções, incluindo navegação em sessão ativa/pausada, reinício e cifra real com valor sintético. [Evidências/limites](TEST-T042.md), [ADR 0023](adr/0023-settings-screen-and-preferences-v2.md).
- T041 permanece aceita com um monitor (D020); múltiplos monitores pertencem a T045. T016 e T036–T039 DEFERRED. Nenhuma captura, credencial pessoal, API real ou custo nesta sessão.

## Próximo passo

Encerrar após commit local de T042. T043 permanece TODO e exige nova sessão independente; não foi iniciada. Não houve push ou deploy.

## Ambiente

Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`. Smoke Electron com escalada revisada, perfis temporários e rede bloqueada. Logs temporários `/private/tmp/t042-*.log`.
