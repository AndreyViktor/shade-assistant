# ADR 0015 — Reconciliação temporal da janela local

Data: 2026-11-06. Tarefa: T018. Aceite da entrega confirmado pelo usuário (D016); medições adicionais pendentes.

## Contexto

A T017 mantinha a ordem de chegada e substituía hipóteses somente por fonte/segmentId. No helper próprio, o ID inclui o início da fala; um início corrigido pode gerar outro ID. Mic/system compartilham a origem temporal da sessão, com offsets preservados na retomada (`TranscriberSession.swift`). Timestamps de emissão e sequências por fonte não são ordem de fala entre fontes.

## Decisão

- Extrair `TranscriptReconciler` puro no core, usado pela `LocalTranscript` no main. Sessão, locale, fontes e sequências continuam validados na janela/provider; renderer apenas apresenta snapshots. JSONL v1 e IPC v3 permanecem iguais.
- Ordenar por `startMs`, `endMs`, fonte (mic antes de system em empate) e sequência. Preservar todos os campos do evento representante. Não aguardar uma janela artificial para reordenar: um evento tardio pode entrar antes de um já exibido.
- Substituir parcial com mesmo ID/fonte, ou início a até 250 ms e interseção de pelo menos 80% do menor intervalo. Um final também remove parciais da mesma fonte inteiramente contidos nele. Intervalos idênticos de duração zero podem ser revisados. Finais são imutáveis por ID; duplicatas finais com faixa e texto normalizado iguais são ignoradas. Parciais tardios que revisam final e terminam até 250 ms depois dele são ignorados.
- A heurística não corta texto nem divide intervalos: revisões maiores sem ID comum/contenção podem permanecer distintas. Falas finais diferentes sobrepostas são preservadas.
- Agrupar possível eco somente entre finais mic/system do mesmo locale, com texto igual após NFC, caixa e pontuação/espaços normalizados; no mínimo 20 caracteres e quatro palavras; início e fim a até 250 ms; interseção positiva de pelo menos 80% do maior intervalo. Exibir o evento original de sistema, independentemente da ordem de chegada. Manter os dois originais enquanto couberem na janela. Não produzir atribuição de pessoa ou confiança acústica.
- Reter no máximo 24 eventos originais (até 4.096 unidades UTF-16 por texto), exibir os últimos 12 após agrupamento. Remover os mais antigos por tempo e conservar somente a posição do último removido para rejeitar história atrasada; nenhum texto de histórico ilimitado. Limpeza reinicia também esse limite. `paused` remove parciais só da fonte correspondente; finais permanecem até stop/falha/reinício ou descarte por limite.
- Preview mostra intervalo relativo à sessão e aviso explícito: fontes não identificam pessoas e falas simultâneas iguais também podem ser agrupadas. Não adicionar persistência, logs de falas ou envio externo.

## Alternativas e consequências

Manter apenas chegada/ID deixa hipóteses órfãs quando o reconhecimento corrige o início. Deduplicação aproximada de texto ou tradução poderia apagar intervenções distintas; não foi adotada. Supressão acústica de eco exige sinais e validação nativa, fora desta heurística textual. Mesmo a igualdade conservadora pode agrupar duas pessoas dizendo a mesma frase ao mesmo tempo; eco com atraso maior ou reconhecimento divergente permanece visível.

O contrato atual aceita um locale por sessão. Testes sintéticos pt-BR/en-US e texto misto validam a política, não reconhecimento bilíngue Apple. A comparação p95 mede somente CPU de recepção/snapshot. Reconhecimento pt-BR+en-US e p95/sobreposição reais permanecem pendentes em O002/O003; D016 aceita a entrega atual como T018 DONE sem declarar esses itens comprovados; roteiro em [TEST-T018](../TEST-T018.md). Esta janela não implementa o ContextManager da T020.
