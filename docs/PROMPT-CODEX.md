# Prompt para uma tarefa Codex

Use este modelo em uma sessão nova por tarefa. Substitua `{Txxx}` pelo ID informado pelo operador; deixe como `primeira elegível` somente quando não houver um ID específico.

```text
Trabalhe no repositório Meeting Copilot e execute somente {Txxx ou primeira elegível}.

Siga o roteiro seletivo de `AGENTS.md`; não leia toda a documentação por padrão. Confira `git status/log`, a tarefa e dependências em `TASKS.md`, o snapshot em `PROGRESS.md` e o código relacionado. Preserve mudanças existentes e consulte fontes especializadas somente quando relevantes.

Antes de editar, elabore o plano exigido por `WORKFLOW.md`, marque a tarefa `IN_PROGRESS` e registre no `PROGRESS.md` um resumo curto. Implemente a menor solução que satisfaça o aceite, siga os padrões relevantes, execute gates aplicáveis e registre status/evidências duráveis na tarefa ou em documentos especializados linkados. Mocks não comprovam validação real.

Siga os invariantes de segurança/produto em `AGENTS.md`; T036–T039 (Windows) permanecem `DEFERRED`. Se um requisito ou gate estiver bloqueado, registre motivo e pare. Faça commit local com `Txxx` no título somente ao concluir a tarefa; sem push. Encerre após uma tarefa.
```

O executor opcional [`scripts/run-codex-tasks.py`](../scripts/run-codex-tasks.py) inicia uma sessão `codex exec` nova por tarefa. Consulte [WORKFLOW.md](WORKFLOW.md); não use `codex resume` para simular uma fronteira entre tarefas.
