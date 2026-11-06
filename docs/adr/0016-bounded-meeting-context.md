# ADR 0016 — Contexto em memória com janela e resumo limitados

Data: 2026-11-06. Tarefa: T020.

## Contexto

A janela de exibição da T018 conserva poucos eventos e agrupa possível eco para o overlay. O contexto futuro de sugestões precisa de retenção própria, revisão de hipóteses e orçamento textual, sem persistir a reunião inteira nem depender de um modelo remoto para compactar texto.

## Decisão

- `ContextManager` no core recebe eventos validados pelo contrato JSONL v1, com sessão, locale e fontes configurados. Rejeita sequências repetidas/antigas por fonte e eventos de outra sessão/configuração. Compartilha `reconcileSpeech` com o reconciliador da T018, preservando sua política de revisão/ordenação. Mantém ambas as fontes no contexto, sem aplicar o agrupamento visual de possível eco ou inferir participantes.
- API interna: `start(config)`, `receive(event)`, `advanceTo(elapsedMs)`, `snapshot()` e `clear()`. O snapshot copia `recent`, `summary` e informa `estimatedTokens`; é `null` fora de uma sessão. `receive` indica aceitação pelo filtro da sessão/janela, não necessariamente mudança textual: uma revisão ignorada pela política de finais pode retornar `true`.
- Janela padrão de 240.000 ms pelo início da fala, com até 128 segmentos. `timestampMs` avança o relógio; `advanceTo` permite expiração durante silêncio, usando o mesmo relógio relativo da sessão. O tempo nunca retrocede. Falas no limite exato permanecem; anteriores saem. O chamador futuro precisa avançar esse relógio e limpar o contexto ao encerrar/cancelar, inclusive quando não houver evento terminal do helper.
- Ao remover um segmento, fechar todo o grupo com o mesmo início e conservar somente esse limite temporal. Eventos cujo início já foi fechado são rejeitados, mesmo de outra fonte ou com sequência maior. Isso limita memória sem acumular IDs para sempre, mas pode perder finais muito atrasados e revisões de parciais já removidos. Não é um histórico completo nem deduplicação global de IDs após descarte.
- Somente finais removidos podem virar resumo extrativo: fonte, locale, ID, intervalo e prefixo de até 240 pontos de código Unicode, com `truncated` explícito. Reter no máximo 12 entradas e 2.000 unidades estimadas, removendo as mais antigas. Parciais recentes permanecem identificados como `partial`, podem ser revisados e nunca entram no resumo. Consumidores devem distingui-los de falas finais.
- Orçamento total padrão de 12.000 unidades: tamanho UTF-8 do JSON `{recent, summary}`, incluindo campos, escapes e metadados. O nome `estimatedTokens` designa uma aproximação conservadora em bytes, não um tokenizer de modelo nem cobrança real. O campo da própria estimativa não entra no payload contado. Prompt, schemas, objetivo e saída futura precisam de reserva e contagem no provider. Nenhum limite de API é garantido por esta aproximação isoladamente.
- Priorizar fala recente: remover resumo antes de retirar mais segmentos por orçamento. Um final grande demais pode virar apenas um trecho; um parcial grande demais é descartado. Se nem o trecho couber no orçamento do resumo, também é removido. Isso pode esvaziar resumo anterior sob pressão de um parcial. Limites configuráveis somente para baixo, com mínimos de 512 unidades totais e 256 no resumo; orçamento do resumo deve ser menor que o total. Contagem/bytes limitam conteúdo retido, não representam medição do heap do runtime.
- Pausa remove parciais da fonte e bloqueia novas falas dela até `listening`. `error`/`stopped` de qualquer fonte válida limpam toda a sessão. `start` e `clear` também limpam texto, sequências, pausa e relógio; configuração inválida no reinício deixa o contexto vazio. Payloads de eventos inválidos geram erros fixos antes de mudar estado. Nenhum arquivo, timer, log, rede, credencial ou captura é criado pelo módulo.

## Alternativas e consequências

Resumo remoto exigiria autorização, rede e custo; resumo semântico local adicionaria tecnologia fora desta fatia. O resumo extrativo é determinístico e verificável, mas pode cortar uma negação/condição e perder decisões antigas; `truncated` não deve ser ignorado pelo consumidor. Não acrescenta fatos e não substitui avaliação humana de qualidade.

Reutilizar o snapshot do overlay perderia conteúdo pelo limite visual e agrupamento de eco. A retenção independente permite testar o contexto sem alterar UI, IPC, JSONL, Swift ou permissões. A conexão ao lifecycle real permanece na T024; esta entrega não envia contexto para IA. T021 permanece separada.

## Evidência

Testes unitários cobrem ordem entre fontes, revisões, silêncio, expiração, pressão por quantidade/bytes, Unicode, isolamento, cópias, pausa, limpeza e fluxo sintético prolongado. Replay integrado usa decoder JSONL real e fragmentos de sete bytes em sessões pt-BR e en-US separadas. Regressões existentes da T018 verificam preservação do overlay. Resultados dos gates em [PROGRESS](../PROGRESS.md); nenhum teste sintético comprova reconhecimento Apple ou qualidade semântica de sugestões.
