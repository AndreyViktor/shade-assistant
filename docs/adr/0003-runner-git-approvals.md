# ADR 0003 — Aprovações de Git no runner

Data: 2026-11-03. Estado: aceito.

## Contexto

A execução da T002 validou os gates, mas não criou o commit: `.git/index.lock` foi bloqueado pela sandbox. `workspace-write` mantém `.git` protegido. O runner anterior não habilitava revisão de escaladas e também podia selecionar outra tarefa apesar de um estado `BLOCKED` existente.

## Decisão

Usar `codex exec --approve-for-me -`, opção documentada oficialmente e presente no CLI 0.166.0 instalado. Ela seleciona workspace-write; não combinar com `--sandbox`, pois o CLI rejeita a combinação antes de iniciar a sessão. O agente solicita escalada para as operações Git autorizadas, e o revisor decide sobre cada pedido. A configuração global e as permissões do repositório não são alteradas. Não usar full access, bypass ou commit feito pelo runner fora do mecanismo de aprovação.

Verificar suporte à flag antes de iniciar uma tarefa. Na ausência de suporte ou autorização, parar sem alternativa automática mais permissiva. Parar também se existir `BLOCKED` ou `IN_PROGRESS`, inclusive no dry-run. Continuam obrigatórios saída zero, estado DONE, novo commit com ID e árvore limpa antes de outra sessão.

## Validação e limites

Testes Python stdlib usam Git real em diretórios temporários e Codex simulado: caminho de sucesso, sessões separadas, CLI incompatível, aprovação recusada, tarefa bloqueada, árvore suja e commit ausente/incorreto. Integram `npm run verify` por `test:runner`. A validação real do serviço de aprovação é separada e registrada no handoff; nenhuma garantia de aprovação deriva apenas dos testes locais ou da presença da flag.

## Alternativas

Desativar a sandbox ampliaria desnecessariamente o acesso. Mover o commit para o runner mudaria a responsabilidade de aprovação e staging. Manter a revisão do Codex é uma mudança menor e preserva o limite de segurança.

## Referências OpenAI Docs

- [Proteção de `.git` e revisão de aprovações](https://learn.chatgpt.com/docs/agent-approvals-security)
- [Modo não interativo e `--approve-for-me`](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Auto-review e tratamento de recusas](https://learn.chatgpt.com/docs/sandboxing/auto-review)
