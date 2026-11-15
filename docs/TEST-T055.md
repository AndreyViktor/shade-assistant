# T055 — Evitar cartões sobre ruído de transcrição

**Data:** 2026-11-15  
**Status:** DONE, com avaliação real do modelo ainda pendente em T027.

## Alteração

O prompt em `src/infrastructure/ai/suggestionFormat.ts` agora diz para não criar cartões que apenas apontam, descrevem ou pedem que alguém corrija/repita/confirme trechos incertos de ASR. A incerteza isolada deve ser ignorada. O modelo só deve inferir a intenção se o contexto confiável sustentar uma interpretação; se nada útil restar, deve retornar a lista vazia.

Foram incluídos dois exemplos pt-BR no prompt: um trecho ruidoso sem contexto acionável produz zero cartões; um trecho igualmente ruidoso, mas com uma revisão e prazo claros no restante da conversa, produz uma ação concreta que não depende do trecho incerto.

O cartão de pergunta continua permitido quando aborda uma questão substantiva da reunião sustentada pelo contexto. A pergunta não pode servir para investigar a qualidade da transcrição.

## Evidências

- `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run test -- src/infrastructure/ai/OpenAISuggestionProvider.test.ts`: 59/59 testes passaram.
- `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`: 884 testes TS passaram, 18 skipped, 19 testes do runner passaram; lint, formato, tipos e build passaram.
- O teste verifica que as regras e exemplos aparecem nas instruções enviadas pelo adapter. O transporte é sintético.

## Limites

- Não foi feita chamada OpenAI, reunião real nem avaliação qualitativa da saída de um modelo; não foi autorizada despesa nesta tarefa.
- O prompt reduz e orienta esse comportamento, mas não garante por si só a qualidade de toda resposta. Avaliação humana representativa continua na T027.
- Duplicidade entre áudio de sistema e microfone e qualidade do STT em vídeos são tarefas separadas T056 e T057.
