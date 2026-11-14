# ADR 0025 — Contexto opcional por sessão

Data: 2026-11-14. Escopo: T053.

## Contexto

O usuário pode informar tema, objetivo ou papel antes de iniciar sugestões. Esse texto precisa de autorização, limite e ciclo de limpeza próprios, sem ser confundido com fala transcrita ou virar preferência persistida.

## Decisão

- IPC de sessão passa de v6 para **v7**. `SessionStart.suggestions.userContext` é opcional; máximo de 2.000 unidades UTF-16, igual ao `maxLength` do campo. Validar antes de remover espaços nas pontas; texto vazio/branco é omitido. Tipos inválidos, campo explicitamente `undefined`, excesso e propriedades desconhecidas são rejeitados. Main, preload, renderer e fixtures migram juntos; v6 é rejeitada. JSONL Swift e IPC de configurações/status não mudam.
- O campo só existe na autorização de sugestões Apple Local, que exige consentimento explícito de texto e orçamento de pedidos. DEMO e transcrição sem sugestões não o aceitam. Preenchê-lo ou abrir diagnóstico não dispara pedidos.
- `MeetingSuggestions` guarda o texto em memória e o inclui em `SuggestionRequest.userContext` a cada tentativa autorizada. A factory recebe apenas modelo/orçamento. O adapter revalida o texto, verifica autorização antes da chave e novamente antes do envio e mantém `store: false`. Não há nova persistência, telemetria ou logs.
- No JSON de entrada, `userContext` é irmão de `recent` e `summary`, nunca um segmento, resumo ou instrução de sistema. O prompt trata os três como dados não confiáveis: contexto opcional só orienta relevância, não comprova fatos/decisões da reunião nem pode substituir as regras. Sem contexto, o modelo continua inferindo ajuda da conversa; com ou sem contexto, resposta vazia continua válida.
- O teto existente de 12.000 bytes UTF-8 do JSON de entrada permanece. Para acomodar contexto opcional, remover primeiro resumos mais antigos e depois trechos antigos, preservando o final mais recente. Não mutar o contexto original. Se esse conjunto mínimo ainda exceder o teto (por exemplo, escapes extremos), retornar `invalid-request` antes de acessar credenciais ou rede. O orçamento continua contando a tentativa, inclusive falhas, sem retries ou chamadas extras.
- O diálogo divulga envio em cada pedido, consentimento/custos e retenção temporária no diagnóstico existente (ADR 0020). Cancelar/iniciar desmonta o diálogo; desmarcar sugestões apaga o rascunho. Stop, revogação, erro de sessão, reload e novo start limpam o contexto pelo ciclo existente. Pausa preserva o contexto para retomar a mesma sessão, mas cancela trabalho e apaga o corpo do diagnóstico; não restaura orçamento.
- A limpeza remove referências do estado controlado pelo app; não promete sobrescrita física da memória ou retirada de conteúdo já enviado ao servidor. O transporte cancelado não pode publicar resultados tardios.

## Alternativas e limites

Persistir um perfil de reunião foi descartado por fugir do aceite e ampliar retenção. Misturar o campo na transcrição criaria falsa atribuição à conversa; inseri-lo nas instruções elevaria dados do usuário a regras do modelo. Aumentar o teto do payload não é necessário para esta entrega.

Testes sintéticos verificam contrato, corpo enviado, consumo de pedidos, silêncio e limpeza. Não medem qualidade de relevância de um modelo real, nem garantem resistência universal a instruções maliciosas. Evidências em [TEST-T053.md](../TEST-T053.md).
