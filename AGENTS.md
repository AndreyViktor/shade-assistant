# Meeting Copilot — instruções do repositório

## Navegação por tarefa

Não leia toda a documentação por padrão. Comece por:

1. `git status` e últimos commits; preserve alterações existentes.
2. A linha da tarefa e suas dependências em [docs/TASKS.md](docs/TASKS.md).
3. O estado atual e o handoff em [docs/PROGRESS.md](docs/PROGRESS.md).
4. Código e testes diretamente relacionados.
5. Consulte apenas a fonte especializada necessária:
   - comportamento do produto: [docs/PRD.md](docs/PRD.md);
   - decisões confirmadas: [docs/DECISIONS.md](docs/DECISIONS.md);
   - arquitetura entre módulos: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md);
   - padrões e gates: seção relevante de [docs/ENGINEERING-STANDARDS.md](docs/ENGINEERING-STANDARDS.md);
   - sessões, Git ou runner: [docs/WORKFLOW.md](docs/WORKFLOW.md);
   - detalhes técnicos/evidências: documentos especializados ligados pela tarefa ou pelo handoff.

Use [docs/PROGRESS-HISTORY.md](docs/PROGRESS-HISTORY.md) somente para investigar decisões ou execuções passadas. Ele é histórico; status e critérios atuais vêm de `TASKS.md`, decisões atuais de `DECISIONS.md`/ADRs, e handoff de `PROGRESS.md`.

## Uma tarefa por sessão

- Execute somente uma tarefa do backlog por sessão. Marque `IN_PROGRESS`, registre um plano específico antes de editar, implemente a menor fatia testável e encerre a sessão após registrar resultado e limites.
- Marque `DONE` somente com critérios e gates aplicáveis comprovados. Atualize `TASKS.md` e o handoff curto em `PROGRESS.md`; faça pelo menos um commit local com `Txxx` no título. Nunca faça push sem autorização.
- Não comece uma tarefa cujo pré-requisito esteja pendente. Se hardware, credencial, permissão ou ambiente impedir o aceite, marque `BLOCKED` e registre o motivo; não pule bloqueios silenciosamente.
- Não executar T036–T039 (Windows), que permanecem `DEFERRED` até nova decisão do usuário.

## Invariantes do produto

- O STT local do MVP macOS é implementado pelo projeto em Swift com APIs Apple; não executar nem empacotar ferramentas externas de transcrição.
- Áudio local permanece no Mac. Texto/imagens só podem ser enviados à OpenAI com autorização explícita; fallback remoto de áudio é opt-in. Demo é offline e identificada.
- Segredos ficam no processo principal/cofre do SO, nunca no renderer, localStorage, IPC genérico, Git ou logs.
- Preservar as fronteiras de segurança Electron (`contextIsolation`, `nodeIntegration` desativado, IPC validado e `webSecurity` ativo); não prometer ocultação universal do overlay.
- Não autorizar custos, permissões privilegiadas, instalação de drivers, remoção do Gatekeeper, push ou deploy sem consentimento humano.

O escopo e decisões atuais estão em `PRD.md` e `DECISIONS.md`; critérios de conclusão e regras de implementação estão em `ENGINEERING-STANDARDS.md`.
