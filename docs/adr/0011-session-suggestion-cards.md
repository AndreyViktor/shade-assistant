# ADR 0011 — Cartões de sugestão em memória

Data: 2026-11-04. Tarefa: T010.

## Contexto

A T009 exibia uma sugestão textual ligada à última fala. T010 exige até dois cartões, categorias, descarte, expiração e deduplicação. Manter essas regras no React duplicaria o estado do main e poderia restaurar cartões descartados a cada consulta.

## Decisão

- `SuggestionStore` em `core/suggestions` controla os cartões em memória, sem UI, Electron, timers ou rede. O `DemoPlayback` no main alimenta o store com conteúdo sintético tipado. Nenhum provider real é introduzido.
- As categorias são `answer`, `question`, `warning` e `action`, apresentadas como Resposta, Pergunta, Alerta e Ação. Cada cartão tem ID, título (até 80 caracteres), corpo (até 300), fundamento (`meeting`/`inference`) e prazo absoluto em milissegundos. Os dois cartões atuais da demo são sugestões a confirmar, não fatos inferidos como certos.
- Mantêm-se os dois cartões mais recentes, em ordem de chegada. Um terceiro substitui o mais antigo, sem fila de cartões ocultos que reapareçam após descarte. Default de expiração: 30 s desde a inserção; duração configurável no construtor para uso/teste, sem nova preferência de UI.
- Deduplicação por ID ou corpo normalizado (Unicode NFKC, caixa e espaços), sem inferência semântica. Duplicata não renova prazo nem muda categoria. Descarte/evicção preserva supressão até o prazo original. A memória de supressão é limitada às últimas 100 entradas válidas; acima desse volume, entradas antigas podem ser aceitas novamente. Stop/reload/close limpam cartões e supressão. IDs incluem a execução da demo para que um descarte atrasado não afete a próxima sessão.
- Expiração usa o relógio do main, mesmo durante pausa e após conclusão do roteiro. Cada leitura elimina expirados; a UI continua consultando a cada 500 ms enquanto houver cartões, incluindo durante pausa, e para quando não há conteúdo ou reprodução pendente. Isso não retoma inferência nem gera envios. Suspensão do processo pode atrasar a atualização visual até a próxima leitura; ajustes do relógio do SO afetam o prazo absoluto.
- O canal de sessão passa a **v2**: `demo.suggestions` substitui o evento único `demo.suggestion`; ação estrita `dismiss-suggestion` recebe somente o ID. Main/preload/renderer e testes migram juntos. v1 é rejeitada explicitamente; não há cliente externo ou estado persistido a migrar. Status e preferências continuam v1. Erros/timeout de transporte preservam a versão do canal.
- Schema valida categorias, campos, limites, até dois cartões e IDs únicos. O renderer exibe texto escapado, rótulo DEMO, fundamento e botão com nome acessível; descarte depende da resposta do main. Leituras atrasadas não sobrescrevem comandos mais recentes.

## Alternativas e consequências

Um estado local no React seria menor inicialmente, mas perderia descarte e prazo ao sincronizar snapshots. Uma fila, deduplicação semântica ou persistência não é necessária para esta fatia. A política atual compara texto normalizado, não detecta equivalência de significado ou troca de tópico. Integração de IA, invalidação contextual, copiar e alternativas permanecem nas entregas correspondentes. Swift, captura, permissões e APIs pagas não fazem parte desta mudança.

## Verificação

Testes de core, schemas, preload, main e React cobrem categorias, limite, duplicatas, prazos, descarte, limpeza e respostas atrasadas. Smoke Electron exercita dois cartões, descarte por Enter e expiração real durante pausa, com rede bloqueada e contada. Resultados executados ficam em `docs/PROGRESS.md`.
