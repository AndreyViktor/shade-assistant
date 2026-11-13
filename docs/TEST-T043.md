# T043 — DEMO em diagnóstico: implementação e bloqueio

Data: 2026-11-13. Base `e6b498a`, T042 concluída. Plano T043 e estado IN_PROGRESS foram registrados antes de alterar código/testes pela sessão iniciada pelo runner.

## Implementação em revisão

O roteiro DEMO foi movido para Preferências → Diagnóstico, preservando identificação de simulação offline, controles de iniciar/pausar/retomar/parar e estado compartilhado da sessão. Ao voltar ao painel durante DEMO ativa, há aviso explícito e ação para parar a simulação. Não inicia transcrição local ou serviços externos; iniciar outra sessão enquanto uma estiver ativa continua bloqueado. Preferências seguem sem terminar a sessão. Os testes React da DEMO foram transferidos para o componente correspondente; testes Electron foram adaptados e foi adicionado cenário de navegação/isolamento com guardas de captura e rede. README e roteiro DEMO foram atualizados.

## Evidências e limites

- `npm run verify` com Node 26: **822 testes TypeScript aprovados, 18 skipped, 19 runner**, lint, formato, tipos e build. Testes unitários com fixtures não equivalem a verificação de interface Electron, acessibilidade real ou confirmação de ausência de captura/rede em processo real.
- A sessão do runner tentou solicitar execução de `npm run test:smoke` fora do sandbox. A revisão automática rejeitou a escalada por entendê-la incompatível com a restrição de sandbox informada à sessão; em seguida, a sessão atingiu limite de uso e o runner encerrou com erro. Nenhum resultado de smoke escalado foi obtido.
- A sessão principal tentou a alternativa dentro do sandbox, sem escalada. O Electron não iniciou: os 21 casos encerraram com `Process failed to launch!`; isso não mede o comportamento do app. Log temporário: `/private/tmp/t043-sandbox-smoke.log`.
- Sem smoke Electron aprovado ou screenshots inspecionados, T043 está `BLOCKED`, não `DONE`. A implementação é provisória e ainda requer validação de layout/teclado, demo offline, ausência de captura/rede, preservação da sessão e regressões. Não alegar imagens ou evidências que não foram produzidas.
- Não houve captura real, envio OpenAI, leitura de chave pessoal, compra de créditos, push ou deploy pelo agente. T045 (múltiplos monitores) continua futura.

## Desbloqueio

Revisar a recusa de escalada e obter autorização efetiva para o smoke Electron offline com perfil temporário, fixtures sintéticas, guardas de rede e de captura. Repetir `npm run test:smoke`, corrigir falhas sem desabilitar testes, inspecionar as evidências visuais e registrar os resultados. O runner não deve prosseguir enquanto T043 estiver BLOCKED. O número e as condições de tarefas selecionadas não autorizam uso de credenciais ou custos reais.
