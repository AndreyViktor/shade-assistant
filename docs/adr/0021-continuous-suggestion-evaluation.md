# ADR 0021 — Avaliação contínua dos trechos finais

Data: 2026-11-12. T024, aceite real pendente.

## Contexto e decisão

O usuário relatou cerca de 20 minutos de transcrição em reunião sem nenhum gatilho. A sessão autorizada solicita uma avaliação para cada atualização de fala final, em vez de exigir correspondência às heurísticas locais. Parciais e passagem do tempo sem fala final não iniciam chamadas. O contexto final é agrupado e limitado como antes; o mesmo modelo decide entre zero e duas sugestões. A classificação local continua visível somente como informação de diagnóstico.

Em modo contínuo, o scheduler agrupa atualizações em uma única avaliação pendente, conserva a primeira data de envio para não adiar indefinidamente sob fala contínua, limita o início das chamadas a uma a cada 10 segundos e mantém somente uma execução ativa. Novas falas atualizam a próxima avaliação, sem cancelar a atual. Isso evita perda contínua de respostas; uma resposta pode refletir um contexto alguns segundos anterior. Cartões continuam sujeitos a deduplicação, descarte e TTL de 30 segundos. Pausa, stop, revogação, erros e prazo limite continuam invalidando/cancelando trabalho conforme o ciclo da sessão. O scheduler original permanece disponível para outros usos e testes.

O limite inicial de tentativas por sessão passa de 1 para 10, ajustável entre 1 e 100. O diálogo informa que fala final e resumo são enviados periodicamente e que o limite é em tentativas, não dinheiro. Não há chamada, chave, captura ou cobrança real no desenvolvimento/testes. Aceitar a mudança de produto não inicia sessão ou autoriza execução paga pelo agente.

## Consequências

Mais conteúdo textual é enviado e o consumo da API pode aumentar. Uma sessão falante pode atingir dez tentativas em torno de 90 segundos após a primeira chamada; o usuário pode configurar outro limite. A avaliação é por texto, sem identificação de participantes ou detecção de mudança de voz. Não há garantia de cartão: o modelo pode retornar zero sugestões, e limites, falhas e expiração continuam aplicáveis. Resultados sintéticos não equivalem ao aceite real.
