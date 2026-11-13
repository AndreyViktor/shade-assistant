# T044 — seleção explícita no runner

A pedido do usuário, `--tasks T040 T041 T042 T043` seleciona somente esses IDs e os executa na ordem informada. Sem a flag, mantém a seleção automática original. Sem `--max-tasks`, uma lista explícita usa seu tamanho como limite; `--max-tasks` pode limitar o ciclo. Até 35 IDs.

Antes de executar o primeiro item, valida lista completa: IDs existentes e únicos, todos TODO, dependências DONE ou em posição anterior. Na execução, relê o backlog e valida estados e dependências reais a cada sessão. Preserva a verificação global de tarefas BLOCKED/IN_PROGRESS, aprovação, árvore limpa, saída zero, DONE e commit com ID. Interrompe ao primeiro erro. `--dry-run` simula apenas a ordenação/dependências futuras; não altera estados, chama Codex ou faz commit.

`npm run verify` com Node 26: 784 testes TS aprovados, 18 skipped, 19 testes Python runner, lint/formato/tipos/build. Sete testes adicionais com Git temporário/Codex simulado cobrem sequência explícita, tarefas não selecionadas, dependências e ordem, IDs inválidos/duplicados/DEFERRED, bloqueio global, dry-run, limite, erro e commit ausente. Teste inicial detectou lista vazia no caminho não dry-run, corrigido antes da aprovação final.

Foi feita simulação isolada do backlog copiado em diretório temporário, com T024 e T044 **hipoteticamente** DONE: dry-run retornou T040, T041, T042, T043. Nenhuma alteração desses estados foi feita no backlog real; T024 segue BLOCKED. Não houve execução real do runner para tarefas M7, captura ou API paga.
