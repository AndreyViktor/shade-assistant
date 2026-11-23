# ADR 0027 — Resultados estruturados ao vivo com evidências

**Data:** 2026-11-19
**Status:** aceito em T060

## Contexto

O painel já envia, com consentimento por sessão, contexto textual limitado à OpenAI para gerar cartões. T060 precisa manter também tópico atual, decisões confirmadas, ações, perguntas abertas e riscos, sem transformar contexto opcional, ausência de fala ou saída não verificável do modelo em fato da reunião. Os resultados precisam sobreviver a correções durante a sessão, mas o produto ainda não possui persistência, revisão manual ou exportação.

## Decisão

- A mesma chamada autorizada de sugestões retorna `suggestions` e `resultUpdates`; não há pedido, custo ou consentimento paralelo. O diálogo informa que falas finais, resumo, resultados atuais e contexto opcional são enviados à OpenAI. Áudio continua local.
- Todo resultado é temporário e fica em memória. Pausar impede novos pedidos e preserva resultados já aceitos; parar, revogar contexto/OpenAI, falhar a sessão, recarregar ou iniciar outra sessão limpa o store.
- O modelo devolve operações `upsert`/`remove` com chave semântica estável, tipo (`topic`, `decision`, `action`, `question`, `risk`), texto, classificação `meeting`/`inference` e uma a três referências `{source, segmentId}`.
- O processo principal só aceita uma referência quando ela resolve para fala final do contexto exato que originou a resposta. Fonte, horário e trecho exibidos vêm do contexto local, nunca do texto de evidência produzido pelo modelo. Referência inexistente invalida apenas aquela operação.
- `decision` exige `groundedIn=meeting`. Inferências são permitidas para os demais tipos, mas aparecem como “Inferência a confirmar”. O schema não possui campos separados de responsável ou prazo; o prompt proíbe inventá-los e orienta omitir detalhes não ditos.
- `upsert` corrige o mesmo par chave/tipo. Trocar o tipo de uma chave é rejeitado. Um novo tópico substitui o tópico anterior. `remove` exige a mesma chave/tipo, texto vazio, grounding de reunião e evidência posterior de retração, resolução ou substituição. Ausência na janela não remove item.
- Limites locais: até 12 operações por resposta, três evidências por operação, chave de 64 caracteres, texto de 240 unidades UTF-16, um tópico e quatro itens de cada outro tipo (17 itens no total). O trecho exibido também é limitado a 240 unidades. O estado existente enviado ao modelo omite o texto duplicado das evidências e participa do orçamento já limitado do payload.
- O IPC de sessão passa de v8 para v9 e inclui snapshot `results` validado estritamente. Snapshot com resultados quando a assistência está desativada é inválido.

## Alternativas consideradas

- **Snapshot completo a cada resposta:** rejeitado porque itens antigos sumiriam quando saíssem da janela móvel, confundindo ausência com correção.
- **Aceitar citações textuais do modelo:** rejeitado porque permitiria fala/horário inventados; a resolução local por identificador preserva a fonte verificável.
- **Store persistente ou edição manual:** adiado. Persistência amplia o risco de dados sensíveis e ações revisáveis pertencem à T066.
- **Chamada separada para resultados:** rejeitada por duplicar custo, consentimento e concorrência sem necessidade.

## Consequências e limites

O estado é determinístico após a resposta, limitado e rastreável até segmentos locais. A validação estrutural não prova que a interpretação semântica do modelo é correta; por isso inferências são rotuladas e decisões exigem regra mais estrita. Não há responsável/prazo estruturado, confirmação humana, persistência, exportação nem avaliação com reunião real nesta tarefa. A qualidade semântica continua dependente do modelo e do STT, dentro dos limites já registrados em T027.
