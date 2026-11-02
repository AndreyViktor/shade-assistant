# Instruções permanentes do Codex — Meeting Copilot V0.7

## Missão
Implementar um assistente local de reuniões **em tempo real** e verificável (não só mock/UI): Electron + React + TypeScript, **módulo Apple Swift próprio** no macOS para STT, modelos OpenAI autorizados para sugestões e visão. Este repositório inicial contém apenas Markdown, sem app construído.

## Fluxo obrigatório: Git e sessões
- **Uma tarefa por sessão**, iniciada como novo `codex exec` ou nova sessão manual. Não continuar a próxima tarefa no mesmo histórico; quem reinicia é o operador ou `scripts/run-codex-tasks.py`. Consulte `WORKFLOW.md`.
- Pelo menos **um commit local por tarefa DONE** (idealmente um commit atômico) incluindo código, testes e registros, título com `Txxx`; nunca push automático. Estado `DONE` somente após evidência verificável.
- Registrar handoff breve em `PROGRESS.md` e encerrar após a tarefa; não carregar transcrições de sessões anteriores.
- Antes da primeira tarefa, inicializar Git e criar commit base se o repositório ainda não existir.

## Leia no começo de cada sessão
1. `PRD.md`, `ARCHITECTURE.md`, **`ENGINEERING-STANDARDS.md`**, **`WORKFLOW.md`**, `DECISIONS.md` (decisões atuais prevalecem sobre hipóteses antigas).
2. `ROADMAP.md`, `TASKS.md`, `PROGRESS.md`; consultar `docs/REFERENCIA-STT-APPLE.md` somente para contexto técnico/histórico.
3. `git status`/últimos commits e código de fato existente.

## Ciclo
1. Conciliar tarefas/progresso com código real; escolher a primeira tarefa `TODO` elegível, sem dependências pendentes, marcar `IN_PROGRESS`.
2. Implementar menor fatia testável, testes unitários/integrados e manuais **quando houver ambiente**; executar lint/typecheck/build.
3. Registrar arquivos/resultado/limites em `TASKS.md` e `PROGRESS.md`, fazer commit **local** somente da entrega validada.
4. **Encerrar a sessão após uma única tarefa.** Um novo processo Codex (operador ou runner) selecionará a próxima tarefa elegível. Se hardware/credencial/permissão/custo bloquear, marcar `BLOCKED`, registrar motivo e encerrar; não pular silenciosamente.
5. **Não executar T036–T039 (M6 Windows): `DEFERRED` até nova decisão do usuário.**

## Qualidade e manutenção — também obrigatórias
- Seguir `ENGINEERING-STANDARDS.md`: módulos com responsabilidade clara, imports dirigidos (`core` sem UI/Electron/OpenAI; renderer sem main/Node), providers por interface, código simples antes de frameworks pesados.
- Scaffold T001–T003 deve instalar/configurar **ESLint, Prettier, TypeScript strict, Vitest/React Testing Library, scripts npm lint/format:check/typecheck/test/build/verify**. Swift Testing/XCTest e verificações Swift conforme ferramentas do Mac (não alegar execução sem ambiente). Lockfile reproduzível e `.editorconfig`.
- Cada implementação deve trazer testes relevantes e passar gates de lint/formatação/tipos/testes/build disponíveis. Não suprimir regras para "passar" nem acumular arquivos que concentrem UI, STT e OpenAI.
- ADR pequeno em `docs/adr/` quando alterar fronteira, contrato, tecnologia fundamental ou segurança. Manter `TASKS.md`/`PROGRESS.md` sincronizados com evidências. Não criar microserviços/abstrações vazias.

## Regras técnicas obrigatórias
- **STT do MVP Mac = Swift próprio**, `SpeechAnalyzer` + `SpeechTranscriber` + captura mic e sistema (`ScreenCaptureKit` para sistema ou API nativa justificada). Verificar capacidade/idiomas/assets/permissões e testar streaming em Mac real.
- O reconhecimento local do macOS deverá ser **implementado pelo projeto em Swift**; não executar nem empacotar ferramentas de transcrição externas, não criar adapter para executável terceiro e não importar protocolo externo sem defini-lo e testá-lo.
- Integração proposta: helper nativo **`MeetingCopilotTranscriber`** iniciado pelo Electron main com `child_process.spawn` sem shell; protocolo JSONL **nosso, versionado**; `AppleNativeTranscriptionProvider`; IPC allowlisted. A ponte pode evoluir com justificativa técnica, mas a implementação continua sendo nossa.
- `SpeechAnalyzer` analisa uma sequência de entrada por instância; planejar segregação mic/system. Locale `pt-BR` é prioritário, pt-BR+en-US opcional e precisa ser **validado no Swift próprio**. Eventos parciais só se realmente suportados.
- OpenAI STT remoto é **fallback opt-in** com consentimento/custo explícitos; não habilitar silenciosamente. Modelos de texto/visão são **configuráveis** e precisam ser verificados na API atual antes de codificar nomes fixos. Codex é a ferramenta de desenvolvimento, não modelo embarcado.
- Modo demo funciona sem chave/sem rede e é rotulado `DEMO`; modo real mostra `APPLE LOCAL (SWIFT)` ou `OPENAI STT`, fontes, idiomas, rede, orçamento e captura ativa.
- Áudio STT local permanece local; texto usado para sugestões e screenshots confirmadas podem ir à OpenAI **somente com autorização**. Sem gravação de áudio bruto, screenshot automático ou transcrição longa persistida por padrão.
- Segredos no cofre SO/main process (ou `OPENAI_API_KEY` apenas em dev): **nunca** renderer, localStorage, IPC genérico, Git, logs/crash.
- Segurança Electron: `contextIsolation:true`, `nodeIntegration:false`, IPC validado, sem desligar webSecurity.
- TriggerEngine deve poder não sugerir nada; evitar repetição e invenção. Screenshot só com prévia e confirmação. Não prometer invisibilidade universal do overlay em compartilhamento; testar no Mac real.
- Não fazer `push`, deploy, comprar créditos, conceder permissões administrativas, instalar drivers, remover quarentena Gatekeeper nem automatizar aprovação de acesso sem consentimento humano.

## Critério de conclusão
`DONE` exige gates e testes de `ENGINEERING-STANDARDS.md`. Os testes exploratórios externos **não provam** captura Swift própria nem ponte Electron. Não anunciar app pronto com somente mocks; registrar evidências em `PROGRESS.md`.
