# T019 — aceite do lifecycle Apple Local

Data: 2026-11-11.

## Aceite manual

O usuário informou: “t 19 is validated, id it is finished we can go ahead”.
Registrar como confirmação de validação da entrega existente (D018), reaproveitando os aceites de captura/controles/transcrição de T014/T015/T017/T018. Não foram fornecidos roteiro, medições ou observações específicas de processos nesta confirmação. Nenhuma nova captura manual foi executada pelo agente nesta sessão.

## Escopo da revisão

Revisados `registerSessionIpc`, `AppleNativeTranscriptionProvider`, o entrypoint Electron e os testes relacionados. A implementação existente cobre controles, cancelamento de início, erros seguros e descarte de eventos tardios. Os testes do provider usam processo simulado; os testes nativos de processo não capturam áudio.

O risco estático documentado permanece: reload/fechamento não aguarda `stopSession()` e quit não coordena a limpeza. Esta sessão não reproduziu helper órfão nem demonstrou ausência de sobreposição de helpers. Não houve alteração de código. A investigação específica permanece em O008, para T024/T032.

## Gates

- `npm run verify:swift`: lint Swift, 47 testes e build release aprovados. A primeira tentativa ficou impedida pelo acesso aos caches Swift na sandbox; a repetição autorizada passou.
- `npm run test:helper`: 16 testes do processo Swift real aprovados, sem captura.
- `npm run verify` com Node 26.0.0: lint, formatação, tipos, 614 testes TS (18 skipped), 12 testes do runner e build aprovados. A primeira tentativa usou Node 20.20.2 do shell, incompatível com o requisito `>=26.0.0`, e falhou ao iniciar workers de testes; não constitui gate aprovado.

Sem chamada OpenAI, custo de API, push ou deploy. Smoke Electron e novos ensaios de captura não foram executados nesta sessão documental.
