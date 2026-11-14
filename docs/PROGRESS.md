# Estado atual e handoff

**Atualizado:** 2026-11-13. **Marco:** M8 — T048 DONE.

## Snapshot

- T046 e T047 DONE: painel compacto e Preferências organizadas, com fonte persistida para a próxima sessão. [TEST-T046.md](TEST-T046.md), [TEST-T047.md](TEST-T047.md).
- T048 DONE: revisão integrada executada no Electron/macOS fora do sandbox, autorizada pelo usuário e aprovada pela revisão automática. Smoke completo 26/26; reteste dos dois cenários novos 2/2 após sincronizar a captura de imagens com a pintura. Verify final: 866 TS aprovados, 18 skipped, 19 runner, lint, formatação, tipos e build. [TEST-T048.md](TEST-T048.md).
- Preferências acessível durante sessão ativa em 960×720, 640×480 e zoom 200%; navegação preserva a sessão. Conteúdo longo, teclado, consentimento, pausa/retomada/parada, erros e DEMO verificados. 25 imagens sintéticas inspecionadas e preservadas em [evidence/T048](evidence/T048/).
- Não foi reproduzida regressão que exigisse mudança no produto. Entrega restrita a dois testes e2e e documentação/evidências; nenhum código Swift ou de produção alterado.

## Limites e encerramento

Somente T048 executada. O bloqueio anterior de lançamento no sandbox foi superado pela execução gráfica aprovada; não houve recusa contornada. Testes com perfis temporários, helpers/transportes sintéticos e rede bloqueada, sem áudio real, credenciais pessoais, API paga, push ou deploy.

Zoom extremo exige rolagem e colunas verticais; imagens mostram partes alcançáveis da viewport. Não houve ensaio manual de VoiceOver, múltiplos monitores, captura real, sessão prolongada ou nova validação de Spaces/tela cheia. T045, T049, T050, T051 e Windows permanecem fora desta sessão. Nenhuma próxima tarefa iniciada.

## Ambiente

- Node >=26: `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`.
- Smoke Electron exige ambiente gráfico disponível; neste sandbox, solicitar execução externa pela revisão normal, preservando fixtures e bloqueios offline. Não contornar recusas.
