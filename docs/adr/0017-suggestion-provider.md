# ADR 0017 — Provider de sugestões com saída validada

Data: 2026-11-06. Escopo: T021.

## Contexto

T020 fornece contexto limitado; T004 mantém credenciais no processo privilegiado. Os cartões T010 já definem conteúdo, IDs locais e expiração. Precisamos de um adapter testável sem ativar envio de texto ou adiantar a integração T024.

## Decisão

- `SuggestionProvider` no core recebe contexto, idioma e AbortSignal; devolve sucesso com zero a dois conteúdos ou falha com código fixo. Não contém Electron, HTTP, chave, trigger ou timers. `SuggestionContent` e os limites existentes são compartilhados pelo parser dos cartões, parser do lote e JSON Schema. O schema enviado se chama `meeting_suggestions_v1`; IPC existente permanece compatível.
- `OpenAISuggestionProvider` na infrastructure usa fetch nativo, somente `https://api.openai.com/v1/responses`, sem redirects ou retries. É destinado ao main e permanece sem ligação ao lifecycle/UI. Injeção de fetch permite testes determinísticos; não há SDK ou dependência nova.
- `model` é obrigatório no construtor, sem default. O host deverá escolher e verificar suporte a Responses/Structured Outputs, disponibilidade na conta e custo antes de uso real. Nome sintético nos testes não representa modelo disponível. Configuração incorreta/indisponibilidade vira falha segura, sem trocar de modelo silenciosamente.
- `getApiKey` permite ao host usar SecretStore ou a fonte dev já autorizada, sem ler chaves ao construir o provider. `isAuthorized` deve verificar consentimento de texto, sessão ativa e autorização de custo; consultado antes da chave, imediatamente antes do envio e antes de devolver conteúdo. O host deve abortar ao pausar/parar/revogar. Essa callback não substitui UX de consentimento nem orçamento, a integrar nas tarefas correspondentes.
- Payload allowlisted contém apenas finais recentes e resumo extrativo, com fonte, locale, intervalo, texto e marca de truncamento. IDs/seq/sessão, parciais e estimativa local de tokens não são enviados. Contexto serializado limitado a 12.000 bytes UTF-8; contexto sem finais/resumo retorna vazio sem chave/rede. Isso não é contagem exata de tokens nem limite monetário.
- Prompt trata transcrição como dados não confiáveis, exige silêncio quando apropriado e diferencia fatos de inferências; resumo truncado não autoriza completar fatos. Sem ferramentas, áudio ou imagens. `store:false`, `stream:false`, `text.format` com JSON Schema estrito e limite de saída configurável (128–4.096 tokens, default 2.048). `store:false` não é promessa de retenção zero pelo serviço.
- Envelope exige status concluído, mensagem assistant concluída e um único bloco `output_text`; aceita metadados de reasoning, rejeita ferramentas/outputs inesperados e trata recusa/incompleto separadamente. JSON é novamente validado localmente: campos exatos, categorias/base conhecidas, zero a dois itens, título até 80 e corpo até 300 unidades UTF-16, não vazios. Limites de sentenças/relevância são instruções ao modelo, não garantias semânticas do parser. IDs e TTL continuam locais.
- Resposta HTTP limitada a 64 KiB, inclusive streams; timeout inclui chave, transporte e leitura (default 15 s, máximo 60 s). Cancelamento fecha a leitura, aborta fetch e descarta resultado tardio. Erros HTTP, parsing, credencial e rede retornam códigos sem body, segredo ou stack; não há logs de conteúdo. Cancelar depois do envio não desfaz dados enviados nem garante ausência de cobrança.
- `MockSuggestionProvider` recebe lote sintético validado, com cópias defensivas, silêncio por default e cancelamento, sem rede. Não altera roteiro DEMO nem implementa heurísticas T022. Integração sintética prova contexto → adapter/mock → store → DTO de cartões e recuperação após falha.

## Alternativas e consequências

SDK OpenAI/Zod adicionariam dependências para uma única operação. Fetch e os parsers pequenos existentes bastam nesta fatia. Asserções de formato do request/response e limites explícitos cobrem o contrato REST, mas não provam compatibilidade de um modelo real nem qualidade das sugestões. Fine-tunes podem não suportar todas as restrições do schema; seleção deve validar esse suporte.

T022/T023 cuidarão de gatilhos e coordenação; T024 ligará o provider à sessão/overlay e fará ensaio real autorizado; T025 implementará orçamento/medição. Não foram executadas chamadas autenticadas nesta tarefa. O sucesso em mocks não prova latência, relevância humana, custo ou disponibilidade na conta. Falhas são valores tipados para que o consumidor preserve a UI; nenhum handler real de sugestões foi conectado nesta entrega.

## Referências verificadas

Consulta à documentação oficial OpenAI em 2026-11-06: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) confirma `text.format`, schema estrito e tratamento de recusa/incompleto; [Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create) documenta a operação. Consulta pública sem credenciais. Nenhum nome de modelo real foi fixado ou presumido disponível.
