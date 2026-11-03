# Meeting Copilot — fundação desktop (T001–T002)

Scaffold executável de **Electron + React + TypeScript strict**, primeiro no macOS. A janela inicial exibe `DEMO`, captura inativa e IA desativada. Ainda não há fluxo de reunião, mocks de transcrição, integração OpenAI ou helper Swift. A arquitetura de produto abaixo descreve as próximas entregas, não capacidades já disponíveis.

## Executar localmente

Use Node **26.0.0** (`.nvmrc`) e npm; as versões exatas das dependências estão em `package-lock.json`. O Node 20 não atende às dependências selecionadas. Com nvm já instalado:

```bash
nvm use
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run dev
```

Na máquina desta entrega, Node 26 já estava em `/opt/homebrew/bin`; foi usado `export PATH=/opt/homebrew/bin:$PATH`, sem alterar instalações globais. Se a versão indicada não existir, instale/selecione um Node compatível antes de `npm ci`.

O instalador explícito do Electron baixa o binário oficial e verifica os checksums; requer rede na primeira instalação. Scripts de lifecycle das dependências não são necessários para este scaffold. Após instalar, a tela inicial funciona sem chave, sem chamadas OpenAI e sem acesso ao microfone ou captura de tela. Desenvolvimento usa apenas o servidor local `127.0.0.1:5173`; encerre com Ctrl+C. Fechar a última janela no macOS mantém o app disponível no Dock; Cmd+Q encerra o processo.

```bash
npm run build
npm start
```

O build gera `dist/main` e `dist/renderer`. `npm start` abre esse build, sem servidor Vite. Ainda não gera instalador, assinatura ou pacote de distribuição (T034).

## Verificações disponíveis

| Comando                | Finalidade                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint com tipos, React Hooks, promessas e restrição básica de imports do renderer  |
| `npm run format:check` | Prettier; preserva os documentos normativos originais listados em `.prettierignore` |
| `npm run format`       | Formata os arquivos verificados                                                     |
| `npm run typecheck`    | TS strict separado para main, renderer e tooling, sem omitir checks das bibliotecas |
| `npm test`             | Vitest + React Testing Library: URL local permitida e estado inicial honesto        |
| `npm run build`        | Compila os dois processos via electron-vite                                         |
| `npm run verify`       | Lint → formatação → tipos → testes TS/Python → build; para no primeiro erro         |
| `npm run test:smoke`   | Build + Playwright abre o Electron real; exige sessão gráfica local                 |

O smoke valida abertura, ausência de Node/IPC no renderer, CSP, recarga sem requisições HTTP(S) e bloqueio de novas janelas. Salva uma imagem somente da janela do teste em `test-results/startup.png` (ignorada pelo Git). Não testa captura, STT ou permissões Apple. `verify` não inicia captura nem utiliza APIs pagas.

`tests/tooling/quality-gates.test.ts` também comprova que ESLint rejeita violações, que os três projetos TypeScript detectam erros strict e que Prettier rejeita formatação inválida. As configurações existentes continuam obrigatórias, sem supressões.

### CI básico

[`.github/workflows/verify.yml`](.github/workflows/verify.yml) executa instalação pelo lockfile e `npm run verify` em Ubuntu 24.04, com Node de `.nvmrc`, em pull requests, push para `main` ou acionamento manual. Actions fixadas por SHA, permissão `contents: read`, sem credenciais persistidas, cache ou secrets. Não baixa o binário Electron nem abre janelas. Smoke gráfico e validação Apple ficam separados. O workflow foi preparado localmente; execução hospedada depende de publicação autorizada, não realizada nesta entrega. Decisões: [ADR 0002](docs/adr/0002-quality-gates.md).

### Tooling Swift: disponibilidade e limites

Verificado neste Mac: macOS 26.6.2, Xcode 26.6 (17F113), Apple Swift 6.3.3 e `xcrun swift-format --version` = 6.3.0. `swiftlint` e `swiftformat` não estão no PATH. Nenhuma instalação global foi feita. O `swift-format` do Xcode é uma ferramenta diferente do SwiftFormat; sua presença não comprova execução de lint ou testes nativos.

Ainda não existe `native/macos/Package.swift`. Portanto, `swift test`, Swift Testing/XCTest e lint/formatação de código nativo **não foram executados**. Na tarefa nativa correspondente, criar testes com Swift Testing ou XCTest, validar SDK e fixar versão/configuração do linter/formatador escolhido antes de torná-lo obrigatório no CI. Não usar instalação automática de versão `latest`. Com pacote e ferramentas validados, os comandos a incorporar são:

```bash
xcode-select -p
xcodebuild -version
xcrun swift --version
swift test --package-path native/macos
# Se swift-format do Xcode for escolhido e sua versão/configuração fixadas:
xcrun swift-format lint --strict --recursive native/macos/Sources native/macos/Tests
```

Esses comandos futuros não substituem os ensaios reais de captura e reconhecimento Apple da T005/T006. Um runner macOS/SDK compatível deverá ser selecionado quando houver implementação nativa; não há job Swift que reporte sucesso sem executá-la.

## Organização e limites

- `src/main/index.ts`: ciclo de vida Electron; `src/main/app`: criação da janela e validação do endereço local de desenvolvimento.
- `src/renderer/app`: shell React e estilos; `src/renderer/main.tsx`: montagem da UI. Não importa Node, main ou infraestrutura.
- `tests/e2e`: smoke do app real; testes unitários ficam junto do código; `tests/setup.ts` prepara RTL.
- `preload` e `contracts` entram com a API IPC de T003. Nenhuma API privilegiada é exposta neste scaffold. `core`, `infrastructure`, features React e `native/macos` serão criados quando tiverem implementação real, conforme `docs/ENGINEERING-STANDARDS.md`.
- Janela com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` e `webSecurity: true`; navegação, popups e permissões de captura bloqueados. CSP de produção não permite conexões; exceções para HMR existem apenas em desenvolvimento.

Escolhas de build, compatibilidade e correção transitiva de dependências: [ADR 0001](docs/adr/0001-desktop-scaffold.md).

## Decisão central de arquitetura

- **Mac MVP:** helper nativo **`MeetingCopilotTranscriber`**, escrito por nós em Swift e integrado ao Electron main. Utilizar `SpeechAnalyzer`/`SpeechTranscriber` e `ScreenCaptureKit` (áudio do sistema); microfone também deve ser suportado com API Apple apropriada. Contrato próprio JSONL versionado → `AppleNativeTranscriptionProvider` → IPC seguro → React.
- **Transcrição autônoma:** nosso módulo Swift usa APIs Apple e não requer biblioteca, CLI, executável ou instalação de transcritor de terceiros. A referência histórica da POC está isolada em `docs/REFERENCIA-STT-APPLE.md`.
- **Idiomas iniciais:** pt-BR prioritário e pt-BR+en-US opcional após validação real do mecanismo bilíngue próprio. Testes exploratórios externos não garantem o desempenho no app.
- **Windows:** fora do gate de entrega macOS. T036–T039 `DEFERRED`.
- **OpenAI:** texto de sugestões e análise de screenshots **somente com autorização e chave do usuário**; STT remoto apenas fallback opt-in com consentimento para envio de áudio/custo. Mocks para demo sem API.

## Qualidade do código e manutenção

**Na V0.7:** `docs/ENGINEERING-STANDARDS.md` define a estrutura de pastas, arquitetura modular, direção de imports, nomenclatura, lint, formatação, teste unitário/integração/e2e, Swift, CI, gestão de dependências e critérios de conclusão. Não introduzir complexidade por antecipação. `AGENTS.md` e `docs/PROMPT-CODEX.md` obrigam o Codex a respeitar essas regras; T001–T003 exigem configurar verificações desde o scaffold.

## Primeiro checkpoint técnico

1. Criar scaffold Electron/React/TypeScript seguindo `docs/ENGINEERING-STANDARDS.md`, incluindo organização por módulos, lint/format, TS strict, testes e script `npm run verify`.
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

O runner requer Python 3 e Codex CLI com `--approve-for-me` (verificado em 0.166.0). Cada sessão mantém `workspace-write` e encaminha pedidos de acesso a `.git` à revisão automática. A execução para se a revisão negar, se o CLI não suportar a opção ou se houver tarefa `BLOCKED`/`IN_PROGRESS`. Detalhes em [WORKFLOW](docs/WORKFLOW.md). Testes locais do runner: `npm run test:runner` (também incluído em `npm run verify`).

**Regra:** uma tarefa = uma sessão Codex nova = pelo menos um commit local se `DONE`. Não carregar histórico inteiro para a próxima tarefa; usar arquivos + Git como memória. Ver `docs/WORKFLOW.md` para regras, mensagens de commit, bloqueios e limitações. Um prompt sozinho não consegue forçar a reinicialização de uma sessão em andamento; o executor externo usa `codex exec` novo a cada tarefa.

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

Alternativa manual: iniciar `codex`, colar `docs/PROMPT-CODEX.md`, pedir **somente T001**, encerrar após o commit e abrir **uma nova** sessão para a tarefa seguinte. **Não use `resume`** quando o objetivo for contexto fresco.

## Como usar no Mac

1. Descompactar o ZIP; entrar na pasta `meeting-copilot-codex/` no Terminal.
2. Verificar pré-requisitos: Node.js, Xcode/Swift para construir o módulo macOS. Compatibilidade exata será definida após a POC T005/T006.
3. Inicializar Git **se ainda não houver repositório** e criar o commit base antes de T001 (comandos acima).
4. Instalar o Codex CLI, se necessário: `npm install -g @openai/codex@latest`; executar `codex` e fazer login com sua conta.
5. Preferir `python3 scripts/run-codex-tasks.py` para abrir nova sessão em cada tarefa. Alternativamente, colar `docs/PROMPT-CODEX.md` no Codex e trabalhar **uma tarefa por sessão**, encerrando após commit.
6. Acompanhar `docs/TASKS.md` e `docs/PROGRESS.md`. Teste real de API somente após armazenamento seguro de chave, autorização e limite de custo.

## Arquivos

A documentação de planejamento e acompanhamento está em `docs/`. `README.md` permanece na raiz como ponto de entrada do projeto, e `AGENTS.md` mantém as instruções aplicáveis ao repositório inteiro. Caminhos escritos em código nos documentos são relativos à raiz; links Markdown são relativos ao arquivo que os contém.

- [docs/PRD.md](docs/PRD.md) — escopo e critérios de aceitação.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — desenho da ponte Swift ↔ Electron, captura Apple, privacidade e IA.
- [docs/ENGINEERING-STANDARDS.md](docs/ENGINEERING-STANDARDS.md) — **estrutura, organização, padrões, lint/format, testes, gates e manutenção**.
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — **Git local, commit por tarefa, handoff e sessões Codex independentes**.
- [scripts/run-codex-tasks.py](scripts/run-codex-tasks.py) — executor mínimo opcional para até N sessões frescas e validação Git.
- [docs/DECISIONS.md](docs/DECISIONS.md) — decisões confirmadas (a mais recente prevalece).
- [docs/ROADMAP.md](docs/ROADMAP.md) — M0–M5 MVP macOS; M6 Windows futuro.
- [docs/TASKS.md](docs/TASKS.md) — 35 tarefas MVP + 4 tarefas `DEFERRED` Windows.
- [AGENTS.md](AGENTS.md) — instruções do Codex em qualquer sessão.
- [docs/PROGRESS.md](docs/PROGRESS.md) — ponto de retomada e evidências observadas.
- [docs/PROMPT-CODEX.md](docs/PROMPT-CODEX.md) — prompt inicial e de retomada.
- [docs/REFERENCIA-STT-APPLE.md](docs/REFERENCIA-STT-APPLE.md) — evidência histórica e referência pública opcional para o desenvolvimento nativo.

## Referências técnicas

- https://developer.apple.com/documentation/speech/speechanalyzer
- https://developer.apple.com/documentation/speech/speechtranscriber
- https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos
- https://www.electronjs.org/docs/latest/api/browser-window
- [docs/REFERENCIA-STT-APPLE.md](docs/REFERENCIA-STT-APPLE.md) — referência exploratória opcional para STT Apple.
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://help.openai.com/pt-br/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
