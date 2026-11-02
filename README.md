# Meeting Copilot — pacote de planejamento para Codex (V0.7)

Este ZIP contém **somente documentos** para o Codex desenvolver um assistente de reuniões desktop **Electron + React + TypeScript**, primeiro no macOS, com **captura/transcrição Apple implementada em Swift próprio** e sugestões contextuais em tempo real. **Nenhum código de aplicativo foi implementado neste pacote.**

## Decisão central de arquitetura
- **Mac MVP:** helper nativo **`MeetingCopilotTranscriber`**, escrito por nós em Swift e integrado ao Electron main. Utilizar `SpeechAnalyzer`/`SpeechTranscriber` e `ScreenCaptureKit` (áudio do sistema); microfone também deve ser suportado com API Apple apropriada. Contrato próprio JSONL versionado → `AppleNativeTranscriptionProvider` → IPC seguro → React.
- **Transcrição autônoma:** nosso módulo Swift usa APIs Apple e não requer biblioteca, CLI, executável ou instalação de transcritor de terceiros. A referência histórica da POC está isolada em `docs/REFERENCIA-STT-APPLE.md`.
- **Idiomas iniciais:** pt-BR prioritário e pt-BR+en-US opcional após validação real do mecanismo bilíngue próprio. Testes exploratórios externos não garantem o desempenho no app.
- **Windows:** fora do gate de entrega macOS. T036–T039 `DEFERRED`.
- **OpenAI:** texto de sugestões e análise de screenshots **somente com autorização e chave do usuário**; STT remoto apenas fallback opt-in com consentimento para envio de áudio/custo. Mocks para demo sem API.

## Qualidade do código e manutenção
**Na V0.7:** `ENGINEERING-STANDARDS.md` define a estrutura de pastas, arquitetura modular, direção de imports, nomenclatura, lint, formatação, teste unitário/integração/e2e, Swift, CI, gestão de dependências e critérios de conclusão. Não introduzir complexidade por antecipação. `AGENTS.md` e `PROMPT-CODEX.md` obrigam o Codex a respeitar essas regras; T001–T003 exigem configurar verificações desde o scaffold.

## Primeiro checkpoint técnico
1. Criar scaffold Electron/React/TypeScript seguindo `ENGINEERING-STANDARDS.md`, incluindo organização por módulos, lint/format, TS strict, testes e script `npm run verify`.
2. No Mac, verificar APIs Swift, versão de macOS/Xcode, permissões, `SpeechTranscriber.isAvailable`, `supportedLocales`/`installedLocales` e `AssetInventory`.
3. Fazer POC Swift própria com **duas fontes** (microfone/áudio do sistema). `SpeechAnalyzer` aceita uma sequência por vez: separar análise por canal; testar `pt-BR` e modo bilíngue.
4. Criar binário Swift próprio e integrar **sem shell** ao Electron main com eventos JSONL validados; exibir as falas no React. Nenhum executável externo de STT será integrado.
5. Construir IA contextual, screenshots, controle de custo, segurança, testes reais e empacotamento assinável no macOS.

## Faturamento e privacidade
- ChatGPT Plus e Codex não significam créditos de **OpenAI API** incluídos; faturamento da API é separado. Não comprar crédito, habilitar faturamento ou copiar credenciais no repositório.
- No STT Apple local, **áudio não precisa deixar o Mac**; porém **texto enviado para sugestões** e **imagens aprovadas** podem sair para OpenAI. Fallback remoto de STT envia áudio **somente após opt-in**.
- Demo com mocks funciona sem chave, sem cobranças e sem rede; deve ser rotulada como simulação.
- Sem gravação de áudio bruto/prints automáticos ou histórico persistido por padrão. Obter consentimento aplicável para reuniões.

## Git e sessões isoladas por tarefa (V0.7)
**Regra:** uma tarefa = uma sessão Codex nova = pelo menos um commit local se `DONE`. Não carregar histórico inteiro para a próxima tarefa; usar arquivos + Git como memória. Ver `WORKFLOW.md` para regras, mensagens de commit, bloqueios e limitações. Um prompt sozinho não consegue forçar a reinicialização de uma sessão em andamento; o executor externo usa `codex exec` novo a cada tarefa.

Após descompactar, inicialize o repositório **uma vez** se ainda não houver Git:

```bash
git init -b main
git add .
git commit -m "chore: initialize meeting copilot planning"
```

Para iniciar a primeira tarefa em sessão nova, depois de instalar/autenticar Codex:

```bash
python3 scripts/run-codex-tasks.py --dry-run  # mostra próxima elegível
python3 scripts/run-codex-tasks.py            # executa 1 tarefa e encerra sessão
# opcional, depois de validar a automação: até 3 sessões independentes
python3 scripts/run-codex-tasks.py --max-tasks 3
```

Alternativa manual: iniciar `codex`, colar `PROMPT-CODEX.md`, pedir **somente T001**, encerrar após o commit e abrir **uma nova** sessão para a tarefa seguinte. **Não use `resume`** quando o objetivo for contexto fresco.

## Como usar no Mac
1. Descompactar o ZIP; entrar na pasta `meeting-copilot-codex/` no Terminal.
2. Verificar pré-requisitos: Node.js, Xcode/Swift para construir o módulo macOS. Compatibilidade exata será definida após a POC T005/T006.
3. Inicializar Git **se ainda não houver repositório** e criar o commit base antes de T001 (comandos acima).
4. Instalar o Codex CLI, se necessário: `npm install -g @openai/codex@latest`; executar `codex` e fazer login com sua conta.
5. Preferir `python3 scripts/run-codex-tasks.py` para abrir nova sessão em cada tarefa. Alternativamente, colar `PROMPT-CODEX.md` no Codex e trabalhar **uma tarefa por sessão**, encerrando após commit.
6. Acompanhar `TASKS.md` e `PROGRESS.md`. Teste real de API somente após armazenamento seguro de chave, autorização e limite de custo.

## Arquivos
- `PRD.md` — escopo e critérios de aceitação.
- `ARCHITECTURE.md` — desenho da ponte Swift ↔ Electron, captura Apple, privacidade e IA.
- `ENGINEERING-STANDARDS.md` — **estrutura, organização, padrões, lint/format, testes, gates e manutenção**.
- `WORKFLOW.md` — **Git local, commit por tarefa, handoff e sessões Codex independentes**.
- `scripts/run-codex-tasks.py` — executor mínimo opcional para até N sessões frescas e validação Git.
- `DECISIONS.md` — decisões confirmadas (a mais recente prevalece).
- `ROADMAP.md` — M0–M5 MVP macOS; M6 Windows futuro.
- `TASKS.md` — 35 tarefas MVP + 4 tarefas `DEFERRED` Windows.
- `AGENTS.md` — instruções do Codex em qualquer sessão.
- `PROGRESS.md` — ponto de retomada e evidências observadas.
- `PROMPT-CODEX.md` — prompt inicial e de retomada.
- `docs/REFERENCIA-STT-APPLE.md` — evidência histórica e referência pública opcional para o desenvolvimento nativo.

## Referências técnicas
- https://developer.apple.com/documentation/speech/speechanalyzer
- https://developer.apple.com/documentation/speech/speechtranscriber
- https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos
- https://www.electronjs.org/docs/latest/api/browser-window
- `docs/REFERENCIA-STT-APPLE.md` — referência exploratória opcional para STT Apple.
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://help.openai.com/pt-br/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
