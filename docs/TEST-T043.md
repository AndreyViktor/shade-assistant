# T043 — DEMO em diagnóstico: implementação e bloqueio

Data: 2026-11-13. Base `e6b498a`, T042 concluída. Plano T043 e estado IN_PROGRESS foram registrados antes de alterar código/testes pela sessão iniciada pelo runner.

## Implementação em revisão

O roteiro DEMO foi movido para Preferências → Diagnóstico, preservando identificação de simulação offline, controles de iniciar/pausar/retomar/parar e estado compartilhado da sessão. Ao voltar ao painel durante DEMO ativa, há aviso explícito e ação para parar a simulação. Não inicia transcrição local ou serviços externos; iniciar outra sessão enquanto uma estiver ativa continua bloqueado. Preferências seguem sem terminar a sessão. Os testes React da DEMO foram transferidos para o componente correspondente; testes Electron foram adaptados e foi adicionado cenário de navegação/isolamento com guardas de captura e rede. README e roteiro DEMO foram atualizados.

## Evidências e limites

- Retomada: a execução gráfica fora do sandbox foi aprovada e iniciou o Electron com fixtures isoladas. O smoke completo teve **19/21** aprovados: a nova navegação aguardava o primeiro cartão por 5 s, embora o roteiro leve 6 s; o teste da DEMO teve fechamento inesperado da página após retomar. A espera do primeiro cartão foi corrigida para 12 s; o reteste dos dois cenários passou **2/2**, sem alteração para a segunda falha, cuja causa não foi identificada. Assim todos os 21 cenários foram cobertos, mas não houve uma única execução completa 21/21.
- Screenshots do painel, Diagnóstico, painel com DEMO ativa e Diagnóstico com zoom foram inspecionados. A imagem em zoom está recortada à direita; a verificação automática passou para ausência de overflow horizontal e foco, mas a imagem não comprova a apresentação completa nessa escala. Revisar dimensões e acessibilidade no fluxo redesenhado em T048. Evidências de interface simulada não substituem validação humana de captura real.
- `npm run verify` com Node 26: **822 testes TypeScript aprovados, 18 skipped, 19 runner**, lint, formato, tipos e build. Testes unitários com fixtures não equivalem a verificação de interface Electron, acessibilidade real ou confirmação de ausência de captura/rede em processo real.
- A sessão do runner tentou solicitar execução de `npm run test:smoke` fora do sandbox. A revisão automática rejeitou a escalada por entendê-la incompatível com a restrição de sandbox informada à sessão; em seguida, a sessão atingiu limite de uso e o runner encerrou com erro. Nenhum resultado de smoke escalado foi obtido.
- A sessão principal tentou a alternativa dentro do sandbox, sem escalada. O Electron não iniciou: os 21 casos encerraram com `Process failed to launch!`; isso não mede o comportamento do app. Log temporário: `/private/tmp/t043-sandbox-smoke.log`.
- A execução anterior sem escalada não gerou evidência funcional; foi substituída pela retomada descrita acima.
- Não houve captura real, envio OpenAI, leitura de chave pessoal, compra de créditos, push ou deploy pelo agente. T045 (múltiplos monitores) continua futura.

## Próximas tarefas

T046–T048 tratam do painel compacto, preferências e revisão integrada; T049–T050 foram adiadas. As tarefas não autorizam uso de credenciais ou custos reais.
