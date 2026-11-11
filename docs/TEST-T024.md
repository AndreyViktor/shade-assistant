# T024 — integração de sugestões na sessão Apple Local

Data: 2026-11-11. Estado: `BLOCKED` somente pelo ensaio real; implementação e gates offline concluídos.

## Execução e autorização

O usuário pediu executar o runner para T023 e T024. T023 terminou no commit `59527e7`. A revisão automática rejeitou o lote irrestrito por possível envio de texto de reunião sem autorização explícita de payload/destino. Foi aprovada uma execução T024 restrita à implementação e testes sintéticos offline, sem captura, leitura de chave real, API paga ou permissões OS novas.

A sessão filha atingiu limite de uso antes do gate completo e do commit; o usuário pediu continuar. A sessão principal retomou as alterações existentes, corrigiu lint/formatação e executou os gates restantes. O script do repositório não foi alterado. Nenhum resultado de mock equivale a aceite real.

## Entrega

Eventos JSONL aceitos → contexto limitado → trigger pt-BR → scheduler → serialização Responses → cartões IPC v4 no overlay. Há opt-in de texto/custo por sessão, modelo explícito, limite de tentativas (default 1), descarte e revogação sem interromper a transcrição. Segredos permanecem no main. O fluxo DEMO é offline.

Ajustes de lifecycle impedem start durante inicialização/parada, invalidam start após stop durante prompt de permissão e fazem quit aguardar cleanup/criação tardia. Evidências são simuladas: não afirmar ausência de processo/captura residual no Mac real.

## Gates

Swift/JSONL não foram alterados; nenhuma captura real foi feita. Gates Swift não foram repetidos nesta mudança TypeScript/Electron.

- `npm run verify` com Node 26.0.0: lint, formatação, tipos, 744 testes TS aprovados (18 skipped), 12 testes do runner e build passaram. Foram corrigidos quatro erros de lint, formatação e dois fixtures antigos que ainda esperavam IPC v3; nenhuma regra ou teste foi desabilitado. São 25 testes TS novos em relação à T023.
- `npm run test:smoke`: 13/13 E2E passaram (incluindo dois novos), Electron real com dados sintéticos e rede bloqueada. Primeira execução no sandbox não lançou Electron (`SIGABRT`/`EPERM`); repetição com escalada aprovada passou. Essa aprovação permite o smoke offline, não o ensaio de captura/API.
- Casos adicionados: autorização estrita IPC v4, chave mock pendente com pause/stop/revoke/reload/failure, limite de tentativas, final/parcial, revisão, silêncio/expiração, respostas antigas, restart/cleanup e quit.
- E2E novo: processo JSONL sintético com uma pergunta, provider real com transporte Responses falso, perfil temporário e chave falsa. Consentimento false produz zero requests/cartões; true produz um request/cartão, descarte/revogação/stop e zero tentativas de rede.

## Roteiro proposto para aceite real — ainda não autorizado/executado

1. Confirmar modelo OpenAI compatível, disponibilidade na conta, preço vigente e autorização de custo para **uma tentativa**, sem retry automático, com até 2.048 tokens de saída. Modelo e estimativa monetária ainda precisam ser definidos; limite de chamadas não é teto em moeda.
2. Usar ambiente silencioso e sem reunião real. Selecionar somente microfone, pt-BR, Apple Local. Autorizar captura e texto separadamente no diálogo, modelo confirmado e limite 1. Chave fica no cofre/main; não colar chave em chat/logs.
3. Falar somente: **“Qual é o prazo do projeto fictício Aurora?”**. O payload esperado contém a transcrição final dessa frase (com possíveis variações do STT), fonte `mic`, idioma e timestamps; resumo inicialmente vazio. Também contém instruções fixas do provider e schema de sugestões. Não contém áudio, imagem, IDs de sessão/segmento ou conteúdo de reunião real. Captura pode incluir som ambiente: manter silêncio fora da frase e parar se surgir conteúdo inesperado.
4. Destino da única tentativa: **POST https://api.openai.com/v1/responses**, `store: false`. Confirmar cartão válido ou silêncio deliberado sem forçar retries. Falha de autenticação/modelo consome a tentativa e exige nova decisão para repetir.
5. Desativar sugestões/parar; confirmar remoção de cartões e transcrição, indicador de captura apagado e helper encerrado. Verificar também quit/reload/restart com captura local e sugestões desativadas, sem chamadas extras, para O008. Registrar observações reais separadas das evidências sintéticas.

Não iniciar esse roteiro sem autorização explícita de captura, payload/destino e custo. T024 não pode ser DONE apenas com gates offline. A medição financeira completa continua em T025; avaliação de relevância/latência e idiomas em T026/T027.
