# ADR 0014 — Transcrição local limitada no snapshot de sessão

Data: 2026-11-06. Tarefa: T017.

## Contexto

T015 inicia o helper próprio, mas descarta falas e não comunica falhas assíncronas ao painel. O canal de sessão já tem consultas autorizadas e proteção contra respostas atrasadas no React.

## Decisão

- Migrar o canal de sessão inteiro de v2 para v3, adicionando `local` (nulo fora da sessão local). Main, preload, consumidores e testes mudam juntos; versões antigas são rejeitadas. O JSONL Swift permanece v1.
- Manter no core uma janela de apresentação com no máximo 12 segmentos (4.096 unidades UTF-16 cada, limite do protocolo) e até dois estados de fonte. A janela tem ID/configuração de sessão, validação estrita no preload e cópias defensivas. Não é o contexto de IA da T020.
- Reutilizar consultas de 500 ms, inclusive em pausa para detectar falhas; uma consulta pendente por hook, sem fila de eventos ilimitada. Isso acrescenta até aproximadamente um intervalo de consulta à latência de apresentação em condições normais; não mede nem promete p95 de STT.
- Mostrar parciais somente quando recebidas do provider validado. Atualizar o segmento pela chave fonte/segmentId, preservando a ordem de chegada. Ordenação entre fontes, reconciliação avançada, eco e idioma bilíngue ficam na T018.
- Stop/recarga/fechamento/reinício descartam texto. Falhas descartam falas e preservam apenas configuração/estado seguro para exibição, sem logs ou persistência. Ignorar eventos de sessões anteriores e falas em pausa.
- Acrescentar callback opcional sem payload ao contrato TypeScript do provider para falhas de transporte/processo após o start. Ele não inventa eventos Speech/JSONL: o main encerra a sessão e o painel informa interrupção. Erros nativos continuam usando códigos allowlisted.
- Timeout de IPC: leitura/descarte 5 s; start 300 s (pode esperar decisão humana TCC); pausa/retomada/parada 15 s para comportar os limites de encerramento do helper. Timeout continua sendo resultado não confirmado, com recuperação via leitura/Parar.

## Alternativas e consequências

Push de eventos exigiria canal/subscrição/cleanup adicional; manter consulta limitada é suficiente para esta fatia. Históricos completos e persistência foram descartados por privacidade/memória. Transcrições transitórias podem não ser vistas entre consultas; os segmentos finais recentes são mantidos. O estado do app é reaproveitado sem chaves, áudio ou caminhos de executáveis no renderer.

O e2e usa um executável JSONL sintético em diretório temporário e substituições apenas no bootstrap de teste, sem flags de bypass no produto; não comprova reconhecimento Swift. O aceite real exige observar mic e sistema no overlay no Mac com consentimento.
