# T018 — reconciliação de fontes, hipóteses e timestamps

## Validação automatizada reproduzível

Usar Node indicado em `.nvmrc`; neste Mac, `export PATH=/opt/homebrew/bin:$PATH` seleciona a instalação existente. Nenhum dos comandos abaixo captura áudio, baixa assets ou chama OpenAI.

```sh
npm run verify
npm run test:smoke
MEETING_COPILOT_COMPARE_TRANSCRIPT=1 npm test -- tests/manual/transcriptComparison.test.ts --silent=false --reporter=verbose
```

- Core: ordem pelo intervalo da fala, desempates, intervalos zero, revisão por ID/início corrigido/contenção, final imutável, duplicatas, repetições, sobreposição distinta, heurística conservadora de eco, cópias defensivas, retenção/limpeza e pausa por fonte.
- Replay: dez eventos inventados, duas fontes, sessões separadas pt-BR/en-US, uma fala com texto misto. Contratos validados a cada snapshot; revisão com mudança de ID, evento tardio, eco, sobreposição distinta, dois “Sim.” simultâneos e repetição posterior. Não há reconhecimento de áudio nesse teste.
- IPC e Electron: subprocesso JSONL sintético → parser/provider reais → main/preload/React, intervalos e fontes visíveis, agrupamento, pausa/retomada/stop e guards de rede sem tentativas. Usa perfil temporário; TCC é substituído somente no bootstrap de teste.

## Comparação sintética com T017

`transcriptComparison.test.ts` preserva em teste a política de apresentação de `0d360cc`: ordem de chegada, substituição por fonte/ID e 12 itens. Compara `receive + snapshot` com o reconciliador T018, sem os custos comuns de validação de sessão, transporte, STT, polling ou renderização. Executa 100 sessões de aquecimento e 1.000 medidas por combinação, dez eventos por sessão (10.000 observações por política), alternando a ordem das políticas. Percentis por rank sobre os tempos medidos; sem gate temporal sujeito a flutuação da máquina.

Execução em 2026-11-06, Node 26.0.0 no Mac de desenvolvimento:

| Replay                                            | p50 T017 (ms) | p95 T017 (ms) | p50 T018 (ms) | p95 T018 (ms) |
| ------------------------------------------------- | ------------: | ------------: | ------------: | ------------: |
| pt-BR, texto normal                               |      0,000458 |      0,000667 |      0,001625 |      0,003000 |
| en-US, texto normal                               |      0,000375 |      0,000500 |      0,001542 |      0,002000 |
| pt-BR, texto preenchido até 4.096 unidades UTF-16 |      0,000417 |      0,000625 |      0,104458 |      0,222333 |
| en-US, texto preenchido até 4.096 unidades UTF-16 |      0,000375 |      0,000583 |      0,103458 |      0,218334 |

O caso preenchido exercita custo de strings longas; sua mudança de comprimento altera a elegibilidade de agrupamento e não é uma amostra de qualidade. Os números são medições locais de CPU, **não latência fim da fala → overlay**, ganho de STT ou prova de desempenho em reunião.

Nas duas sessões de texto normal: 8 inversões de início → 0; 10 itens → 7; 3 parciais → 1 (a única ainda em andamento); 4 pares de finais sobrepostos → 2. Permanecem o par de falas distintas e o par curto “Sim.”; sai um representante de eco e sua sobreposição redundante com a fala distinta. Repetição posterior preservada. Essas contagens verificam o resultado esperado do roteiro, não precisão acústica, WER ou redução de eco real.

## Ensaios adicionais pendentes (O002/O003)

Não executar captura automaticamente. Operador deve autorizar fontes no app e conceder TCC manualmente quando necessário, com participantes informados. Usar exclusivamente falas sintéticas; não registrar áudio, texto de reunião ou screenshot real por padrão.

1. Iniciar Apple Local, pt-BR, mic + sistema. Observar intervalos relativos, ordem da fala independentemente da chegada e atualização parcial → final sem hipótese órfã. Repetir uma frase mais tarde: ambas devem aparecer. Falar “Sim.” nas duas fontes: manter ambas.
2. Reproduzir frase longa pelo sistema, permitindo vazamento controlado no mic. Comparar com o mesmo roteiro na T017 (`0d360cc`, em checkout separado pelo operador). Anotar apenas contagens de duplicatas/supressões indevidas, revisões órfãs e pares sobrepostos. Fazer também falas distintas simultâneas e frases iguais simultâneas; esta última é limitação conhecida da heurística, não diarização.
3. Pausar durante parcial, confirmar descarte apenas da hipótese e retenção dos finais. Retomar e conferir continuidade dos tempos; parar e confirmar limpeza.
4. Medir pelo menos 20 amostras de fim da frase → primeiro final visível em cada versão/fonte, usando relógio comum e marcas de tempo sem conteúdo. Reportar mediana e p95 (rank `ceil(0,95 × N)`), N, método e erros de observação; não subtrair relógios sem sincronização. Isso ainda inclui erro humano e não substitui instrumentação para uma meta de produção.
5. en-US isolado exige assets previamente autorizados/disponíveis. O modo simultâneo pt-BR+en-US **não existe no contrato v1/helper atual**. A estratégia nativa e seu contrato ainda precisam de implementação e validação; D016 aceita T018 sem declarar esse suporte disponível. Texto misto sintético não atende esse requisito.

Registrar somente ambiente, fontes/locales, contagens, percentis e confirmação humana em PROGRESS. Por aceite explícito do usuário (D016), T018 está DONE; estes ensaios adicionais permanecem pendentes em O002/O003 e não bloqueiam T020/T021.
