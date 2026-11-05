# Prompt para uma tarefa Codex

Use este modelo em uma sessão nova por tarefa. Substitua `{Txxx}` pelo ID informado pelo operador; deixe como `primeira elegível` somente quando não houver um ID específico.

```text
Trabalhe no repositório Meeting Copilot e execute somente {Txxx ou primeira elegível}.

Antes de editar:
1. Leia AGENTS.md e os documentos obrigatórios indicados nele.
2. Confira git status/log, TASKS.md, PROGRESS.md e o código relacionado. Preserve mudanças existentes e reconcilie o estado com a implementação real.
3. Respeite decisões confirmadas em DECISIONS.md. T036–T039 (Windows) permanecem DEFERRED.

Implemente a menor solução testável que satisfaça os critérios de aceite. Siga ENGINEERING-STANDARDS.md; escreva testes relevantes; execute os gates aplicáveis e registre resultados reais, arquivos alterados e limites em TASKS.md e PROGRESS.md. Não declare mocks como validação real.

Para o MVP macOS, STT local deve ser implementado pelo projeto em Swift usando APIs Apple. Não execute nem empacote transcritores de terceiros. OpenAI STT é fallback opt-in; texto/imagens só podem ser enviados com autorização. Preserve os limites de segurança Electron e segredos.

Se hardware, permissão, custo ou ambiente impedir um gate, registre o impedimento e marque BLOCKED; não esconda falhas nem inicie outra tarefa. Faça ao menos um commit local com Txxx no título somente quando a tarefa estiver realmente DONE. Não faça push. Encerre após esta tarefa.
```

O executor opcional [`scripts/run-codex-tasks.py`](../scripts/run-codex-tasks.py) inicia uma sessão `codex exec` nova por tarefa. Consulte [WORKFLOW.md](WORKFLOW.md); não use `codex resume` para simular uma fronteira entre tarefas.
