# ADR 0020 — Diagnóstico local das sugestões

Data: 2026-11-12. Escopo: ajuste T024; aceite real continua pendente.

## Contexto

O usuário não consegue distinguir ausência de gatilho, falha de conexão, resposta vazia e limite consumido. Solicitou ver o conteúdo enviado e o estado da integração.

## Decisão

- IPC de sessão v5 exige `suggestions.diagnostics`: nulo quando desativado, validado e limitado quando ativo. Main, preload, renderer e fixtures migram juntos; v4 é rejeitado. JSONL Swift permanece v1.
- O provider informa o corpo JSON exato entregue a `fetch` e o status HTTP recebido por callbacks internos. Nunca publica headers, chave, respostas brutas, mensagens de exceção ou erros remotos. O core registra somente a última tentativa: número, início, duração, corpo, HTTP, resultado seguro e quantidade de sugestões. Renderer mostra JSON formatado sem alterar o envio.
- O core expõe modelo, limite, último gatilho e estágio real do scheduler/provider. Ter uma chave configurada ou chamar `fetch` não comprova conexão. Somente um HTTP recebido comprova retorno do servidor; resposta validada, vazia, rejeitada e cancelada são estados distintos. Tentativa em andamento tem prioridade visual sobre limite esgotado.
- Dados ficam apenas em memória, sem logs, disco, exportação ou analytics. Pausa apaga o corpo, preservando metadados; stop, revogação, erro de sessão, reload e novo start limpam tudo. Callbacks após cancelamento ou de gerações antigas são ignorados. O contrato limita corpo a 32.768 caracteres; o provider já limita contexto serializado a 12.000 bytes antes da inclusão das instruções/schema.
- Abrir o painel não dispara ping, teste de chave, retry nem chamada extra. Consentimento, limites, gatilhos pt-BR e políticas de descarte/expiração existentes continuam vigentes. O painel oferece roteiro fictício para o usuário testar em sessão explicitamente autorizada.

## Alternativas e limites

Logs de requisição/resposta completos foram rejeitados por conterem segredos/conteúdo persistente. Um teste de conexão independente exigiria operação adicional e poderia gerar custos sem testar o caminho real da transcrição; acompanhar a própria chamada cobre o pedido atual.

HTTP 429 permanece categoria ampla: pode representar frequência, créditos ou limites. Sem ler/exibir o erro remoto bruto, orientar verificar esses fatores e mostrar o status real, sem afirmar uma causa específica. Referência consultada: [OpenAI — Error codes](https://developers.openai.com/api/docs/guides/error-codes).

Não há histórico de todas as tentativas nem captura de resposta bruta. O diagnóstico não altera a política conservadora que cancela requisições ao mudar o contexto; cancelamento pode acontecer depois do envio e não elimina possíveis custos. Uma resposta válida também não garante um cartão ainda visível, devido a invalidação/dedup/TTL.

Evidências e limites de validação em [TEST-T024.md](../TEST-T024.md).
