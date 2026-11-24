# ADR 0032 — Verificação factual de vídeos

Data: 2026-11-24. Escopo: T078 (ensaio real pendente).

## Decisão

O novo perfil é efêmero e exige áudio do sistema, autorização de texto e consentimento explícito específico para busca na web. A transcrição continua local. O provider utiliza `web_search` da Responses API com até duas chamadas de ferramenta por pedido, além do limite existente de pedidos, que não é um limite monetário. A busca pode enviar consultas derivadas do texto e gerar cobrança adicional. O modelo escolhido deve suportar busca e saída estruturada.

O agendamento observa somente trechos finais do sistema, reúne contexto por 20 segundos e não reavalia trechos já selecionados para uma tentativa, salvo revisões. Isso também evita repetição após falhas, mas pode perder verificações. Os perfis anteriores conservam seus gatilhos. Cada correção exige chamada de busca concluída, URL HTTPS presente nas anotações de citação e segmento final novo encontrado localmente; a interface exibe a fala, horário e fonte clicável. Abrir fonte requer ação explícita e um ID de cartão ativo validado no processo principal. Respostas sem evidência estrutural válida não geram cartões. Pausa, revogação e parada cancelam ou invalidam resultados pendentes.

A validação de referências não comprova que a fonte é confiável nem que ela contradiz a afirmação; isso depende do modelo e de avaliação empírica. Opiniões, erros de transcrição e incertezas devem resultar em silêncio. Resultados podem conter erros, omissões ou repetições semânticas. Consultas e conteúdo de resposta não são registrados em logs ou persistidos pelo aplicativo. O diagnóstico existente pode conter o corpo do último pedido enquanto a sessão estiver ativa.

## Referências

- [Documentação oficial: web search e citações](https://developers.openai.com/api/docs/guides/tools-web-search).
- [Referência da Responses API: limite de chamadas de ferramentas](https://developers.openai.com/api/reference/resources/responses/methods/create).
