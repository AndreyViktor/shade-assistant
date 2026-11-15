# ADR 0026 — Todos os cartões reais da sessão

Data: 2026-11-15. Escopo: T054.

## Contexto

O limite de dois cartões reais, definido em T040/ADR 0022, descartava o cartão mais antigo a cada nova inserção aceita. Isso escondia respostas ainda úteis e contrariava o uso do painel ao lado do histórico da reunião. O usuário pediu remover esse limite e acessar todos os cartões por rolagem.

## Decisão

- Uma resposta real pode conter **zero a oito** sugestões. O prompt pede até oito itens distintos e relevantes, sem preencher a cota; a saída vazia continua válida. A DEMO roteirizada permanece independente, com dois cards e TTL de 30 s.
- O orçamento atual permite até **100 pedidos por sessão**. O teto estrito do lote e do snapshot é derivado: 8 × 100 = **800 cartões reais por sessão**. O store preserva os itens aceitos até esse teto e não substitui os mais antigos. Ao atingir o teto, rejeita novas inserções; não altera o orçamento de pedidos nem cria chamadas adicionais.
- Permanecem deduplicação por ID/conteúdo, descarte explícito por ID e limpeza no ciclo da sessão. Cards reais não expiram por tempo. Pausar, parar, revogar, encerrar ou reiniciar mantém os comportamentos de limpeza já aceitos. Um resize não altera o snapshot.
- O store mantém a ordem de chegada; a UI apresenta os mais recentes primeiro em uma lista `<ul>` rolável, com limite de altura próprio, foco por teclado e os cards mais antigos disponíveis abaixo. A DEMO usa sua ordem roteirizada. A rolagem não impõe um limite de exibição nem remove conteúdo.
- O contrato estrito do IPC de sessão passa de **v7 para v8** porque snapshots agora podem conter até 800 itens. O parser aceita até esse teto e rejeita v7, excedentes, duplicatas de ID e propriedades extras. Main, preload, renderer e fixtures migram juntos; não há estado persistido ou cliente externo a migrar.
- O diagnóstico informa até oito itens por resposta. A interface explica retenção, ordem e descarte sem mencionar substituição por cards novos. O limite de pedido remoto e o consentimento permanecem iguais.

## Alternativas e limites

Manter só dois itens ou substituir os antigos foi rejeitado por apagar contexto que o usuário ainda poderia consultar. Uma fila oculta não resolveria a perda percebida e complicaria a restauração após descarte. Um teto sem relação com o orçamento permitiria crescimento de memória desnecessário; 800 corresponde ao máximo atual de respostas autorizadas, sem evicção antes desse teto.

O limite de oito por resposta é protocolar e não uma promessa de que cada pedido gere oito sugestões; o modelo pode retornar qualquer quantidade de zero a oito. Deduplicação continua sem análise semântica e pausa continua limpando cards conforme a política confirmada. Nenhum teste desta tarefa usa fala real, credencial real ou chamada paga.

Testes cobrem resposta 0/8/9, retenção até 800, contrato v8, ordem visual, rolagem por teclado, resize, descarte e limpeza. Evidências em [TEST-T054.md](../TEST-T054.md).
