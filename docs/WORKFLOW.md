# Fluxo de trabalho Git e sessões Codex — Meeting Copilot V0.7

## Objetivo
Rastreabilidade sem Git Flow sofisticado e **contexto novo por tarefa**. O estado durável fica no repositório (código, testes, `docs/TASKS.md`, `docs/PROGRESS.md`, ADRs e Git), não no histórico de chat. **Uma tarefa = uma execução do Codex = pelo menos um commit local quando `DONE`.** O objetivo é preferencialmente um commit atômico por tarefa; commits adicionais só quando houver divisão técnica justificada.

## 1. Git local simples
- Usar uma única branch `main` durante o MVP. Não criar develop/release/feature branches ou pull requests por obrigação. Não há remoto obrigatório; **nunca executar `git push` sem autorização**.
- Antes de T001, se o diretório ainda não for repositório, executar **uma vez**:

```bash
git init -b main
git add .
git commit -m "chore: initialize meeting copilot planning"
```

- **Não reinicializar** um repositório existente; conferir `git status`, `git branch --show-current` e `git log -3 --oneline`. Em caso de conflito/alterações prévias, interromper e pedir decisão. Não apagar mudanças do usuário, não usar `git reset --hard`, `git clean -fd`, `--force` ou `--amend` sobre commits existentes sem autorização.
- Mensagens de commits de tarefas: `feat(T001): scaffold Electron and React`, `test(T006): verify Swift audio sources`, `fix(T014): handle native process exit`, ou `chore(T002): configure quality gates`. **Cada commit que conclui uma tarefa deve mencionar `Txxx` no título.**
- O commit de conclusão inclui implementação, testes, atualizações de `docs/TASKS.md` e `docs/PROGRESS.md`; não incluir segredos, gravações de reuniões, logs sensíveis, caches, binários de build, dados pessoais ou `.env`.
- **Não marcar DONE** se gate aplicável falhar, testes relevantes não forem executados ou evidências exigidas estiverem ausentes. Registrar `BLOCKED` com motivo verificável, deixando o código em estado conhecido. Um commit `docs(Txxx): record blocker` é permitido para registrar bloqueios, mas **não conta como conclusão**.

## 2. Uma tarefa por sessão, sem acúmulo de histórico
- Cada execução começa como uma **nova sessão `codex exec`** (não `codex resume` nem `codex exec resume`) e trabalha **somente em uma tarefa**, mesmo que sobre tempo ou tokens.
- O Codex lê apenas os arquivos necessários: `AGENTS.md`, este fluxo, as decisões e padrões relevantes, a linha da tarefa, `docs/PROGRESS.md`, `git status/log` e **os arquivos de código relacionados**; não carregar toda a transcrição de sessões passadas. Use o README para navegação quando preciso.
- Marcar `IN_PROGRESS` ao iniciar. Implementar, validar, registrar evidências e limitações, marcar `DONE` **somente após aceitação real**, criar commit local e **encerrar a sessão**. Não começar tarefa seguinte na mesma sessão.
- `docs/PROGRESS.md` deve manter um handoff **curto e objetivo**: tarefa, resumo técnico, testes realmente executados, resultado e limites, hash do commit, impedimentos, próximo trabalho elegível. Git + arquivos são a fonte de verdade; não confiar em resumos sem verificar.
- Nova sessão ≠ contexto zero absoluto: AGENTS.md e os arquivos do projeto serão relidos, mas não o histórico de conversa da sessão anterior. Isso reduz deriva e esgotamento de janela, não elimina erros de modelo. Code review e testes continuam obrigatórios.
- Uma sessão interativa `codex` não pode garantir que ela própria abra um novo processo independente a cada tarefa. Para execução automática real, **a troca de sessão precisa ser feita externamente** (script mínimo abaixo ou operador humano). Compaction pode ajudar dentro de uma tarefa longa, mas **não substitui a fronteira entre tarefas**.

## 3. Executor leve (opcional)
- `python3 scripts/run-codex-tasks.py --dry-run` mostra a primeira tarefa `TODO` cujas dependências estão `DONE`, sem iniciar Codex. Tanto simulação quanto execução param se existir tarefa `BLOCKED` ou `IN_PROGRESS`, mesmo que outra seja elegível.
- `python3 scripts/run-codex-tasks.py` inicia uma sessão nova `codex exec --sandbox workspace-write --approve-for-me -` para uma tarefa e termina.
- `python3 scripts/run-codex-tasks.py --max-tasks 3` pode executar **até 3 tarefas em sequência**, iniciando um processo **novo** por tarefa. É apenas um loop limitado, não uma plataforma de agentes.
- Antes de executar, o runner confirma em `codex exec --help` o suporte a `--approve-for-me`. Se ausente, encerra sem iniciar tarefa ou alterar permissões. Validado com Codex CLI 0.166.0.
- `workspace-write` protege `.git`; o agente deve solicitar escalada para o commit local pelo mecanismo normal de aprovação. `--approve-for-me` encaminha pedidos elegíveis à revisão automática. A revisão pode negar; nesse caso, registrar `BLOCKED` e parar, sem fallback para full access, alteração global de configuração ou execução de Git fora do fluxo de aprovação.
- Em cada passagem, o script exige árvore Git limpa, seleciona uma `TODO` elegível, manda executar somente aquela tarefa, e **verifica** ao retornar: estado `DONE`, commit com ID da tarefa e árvore Git limpa. Se falhar, parar e informar. Não forçar reset, não passar ao próximo após erro/`BLOCKED`. Pode ser necessário retomar manualmente após corrigir bloqueios.
- CLI precisa estar instalada e autenticada e Git com autor configurado. O runner **não** autoriza pagamentos, instala drivers, acessa credenciais, executa push/deploy ou contorna sandbox. Exigir confirmação humana para ações sensíveis. `workspace-write` é capacidade de editar o repositório, não acesso irrestrito ao sistema.
- **Controle de custos/limites:** preferir `--max-tasks 1` inicialmente, revisar commits e resultados, ampliar para três ou mais somente após comprovar estabilidade; cada sessão do Codex consome sua cota conforme o plano.

## 4. Quando uma tarefa falha
- Execução interrompida, sem commit, `IN_PROGRESS` remanescente, arquivo sujo, `BLOCKED` ou `DONE` sem teste/commit → **parar**. Examinar `git diff`/`git status`, corrigir o problema e retomar com sessão nova direcionada à tarefa, não ignorar um estado inconsistente.
- Se a tarefa necessita Mac, permissão ou chave da API indisponíveis, registrar bloqueio e retornar ao usuário. Outras tarefas independentes podem ser escolhidas em outro ciclo **somente após triagem explícita do bloqueio**; o runner padrão não pula bloqueio automaticamente.
- Código de um task não deve incluir refatorações amplas fora do escopo. Se descobrir necessidade arquitetural, escrever ADR curto e registrar tarefa específica.

## 5. Critério de aceite para o fluxo (não para o app)
- O **script** só pode declarar sucesso após verificar `DONE` + título de commit com ID + árvore limpa + saída zero. Isso não prova, por si, a qualidade dos testes: o Codex precisa fornecer evidências nos arquivos.
- `npm run test:runner` usa unittest/Python stdlib, Git real em repositórios temporários e Codex simulado para testar aprovações, recusas, bloqueios, commits, árvore suja e sessões separadas. Esses testes não provam aprovação do serviço: a execução real deve ser registrada em `docs/PROGRESS.md`.
- O suporte da flag no CLI não comprova disponibilidade de auto-review na conta ou permissão organizacional; eventual recusa/indisponibilidade encerra a execução, preservando as alterações.

Referências: https://learn.chatgpt.com/docs/developer-commands (CLI `codex exec`) e https://learn.chatgpt.com/docs/non-interactive-mode.

Referências da correção do runner: [modo não interativo](https://learn.chatgpt.com/docs/non-interactive-mode), [proteção de `.git`](https://learn.chatgpt.com/docs/agent-approvals-security) e [auto-review](https://learn.chatgpt.com/docs/sandboxing/auto-review).
