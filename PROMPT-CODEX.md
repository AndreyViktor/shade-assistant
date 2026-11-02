# Prompt inicial para colar no Codex — V0.7

Você é o implementador principal do **Meeting Copilot**, desktop Electron + React + TypeScript. Desenvolva código real, com a transcrição no macOS implementada por **nosso próprio módulo Swift**, não apenas UI/mock.

**Leia primeiro:** `AGENTS.md`, **`WORKFLOW.md`**, `PRD.md`, `ARCHITECTURE.md`, **`ENGINEERING-STANDARDS.md`**, `DECISIONS.md`, `ROADMAP.md`, `TASKS.md`, `PROGRESS.md`. `docs/REFERENCIA-STT-APPLE.md` é leitura de referência opcional para o spike nativo. Depois reconcilie código e Git. As decisões confirmadas mais recentes prevalecem.

**DECISÃO IMPORTANTE:** o aplicativo **não utilizará executáveis ou CLIs externas de transcrição**. Para o **MVP macOS**, implemente `MeetingCopilotTranscriber` em Swift com APIs Apple `SpeechAnalyzer`/`SpeechTranscriber` e captura de microfone e áudio do sistema via APIs Apple apropriadas (`ScreenCaptureKit` como candidato a sistema). Crie uma ponte segura **Swift próprio → Electron main → preload IPC → React**. Sugestão: helper nativo próprio + `child_process.spawn(..., {shell:false})` + JSONL **com protocolo nosso**; validar schemas, eventos e encerramento. Se descobrir alternativa técnica melhor, registre justificativa e testes, preservando a autoria própria do módulo.

**PONTO DE PARTIDA:** Execute **T001** primeiro, depois **T005/T006 cedo** para verificar compatibilidade do Mac (macOS/Xcode, suporte real do SDK), `SpeechTranscriber.isAvailable`, `supportedLocales`/`installedLocales`, `AssetInventory` e permissões TCC de microfone/ScreenCaptureKit. `SpeechAnalyzer` processa uma sequência de entrada por vez: avaliar analisadores/fluxos independentes para mic e sistema. Priorize pt-BR; disponibilize pt-BR+en-US somente após testes. O resultado subjetivo de uma POC externa **não valida Swift próprio**. Teste no Mac real e não fabrique resultados.

**MVP:** Implementar apenas T001–T035 como trabalho elegível. T036–T039 são Windows futuro `DEFERRED` até nova autorização. OpenAI STT remoto é fallback **opt-in**, só com aprovação de custo e envio de áudio. Sugestões e screenshots via OpenAI Responses API com modelos **configuráveis**, cuja disponibilidade/preço devem ser conferidos antes de integração. Não utilizar Codex como runtime de inferência. Modo demonstração deve funcionar totalmente offline e rotulado `DEMO`.

**Comportamento das sugestões:** nunca sugerir a cada fala; detectar pergunta, objeção, compromisso e solicitação manual; tratar silêncio e evitar duplicata. Fornecer até dois cartões concisos com contextualização; não inventar fatos; medir latência, pertinência e consumo.

**Segurança/privacidade:** STT Apple local mantém áudio no Mac; texto de contexto e screenshot confirmado podem sair para OpenAI mediante consentimento. Nenhuma gravação bruta por padrão. Não enviar chaves ao renderer/IPC genérico, não gravar falas nos logs, respeitar limite de custo e stop/pause. Captura exige autorização e indicador visível; screenshots apenas com prévia/confirmar. Não garantir invisibilidade do overlay em todos os capturadores.

**MANUTENIBILIDADE (obrigatório):** siga `ENGINEERING-STANDARDS.md`. Crie uma estrutura modular simples (`core` puro, adaptadores em `infrastructure`, composição no `main`, IPC no `preload`, UI por feature no `renderer` e helper Swift em `native/macos`). Configure ESLint, Prettier, TS strict, testes Vitest/RTL e `npm run verify` cedo; testes nativos Swift e checks no Mac. Prefira composição, responsabilidades pequenas e contratos validados; não introduza microserviços, Redux ou padrões complexos sem necessidade. Para cada tarefa, faça testes, lint, formatação, types, build e documente evidências; não desabilite regras para ocultar erros. Atualize `docs/adr/` quando uma decisão arquitetural mudar.

**Ciclo (uma tarefa por sessão):** Selecione a primeira tarefa `TODO` elegível (ou a tarefa específica indicada pelo executor), marque `IN_PROGRESS`, implemente e teste, rode lint/typecheck/build, registre evidências em `TASKS.md` e `PROGRESS.md`, faça **pelo menos um commit local com `Txxx` no título** e **encerre esta sessão**. NÃO avance à próxima tarefa no mesmo histórico. Uma próxima sessão fresca será iniciada pelo operador ou pelo script `scripts/run-codex-tasks.py`. Se hardware/permissão/API key/custo/consentimento bloquear, marque `BLOCKED`, documente e encerre sem pular automaticamente. Não instalar drivers, autorizar pagamentos, fazer push/deploy ou conceder permissões administrativas sem aprovação. Não confundir testes mock com reais.

Comece por **T001** e conclua somente essa tarefa nesta sessão, com testes, `PROGRESS.md` e commit local. Depois encerre. O runner ou o operador abrirá outra sessão para a próxima tarefa.

---

## Execução com contexto fresco por tarefa
Leia `WORKFLOW.md`: `python3 scripts/run-codex-tasks.py` inicia uma nova sessão Codex para uma tarefa, e `--max-tasks 3` faz até três sessões sequenciais com verificação Git. **Não usar `codex resume`** nesse fluxo. Modo interativo manual: abrir uma sessão nova por tarefa e parar após o commit.

## Retomar depois
`Releia AGENTS.md, ENGINEERING-STANDARDS.md, DECISIONS.md, PROGRESS.md, TASKS.md, git status/log e os testes/código. Preserve a decisão de Swift próprio (sem STT externo no runtime), reconcilie discrepâncias, execute somente a tarefa indicada/primeira elegível, valide, registre handoff e faça commit local com ID. Encerre sem começar outra tarefa. Não repetir tarefas já validadas.`
