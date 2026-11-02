# Progresso e handoff — Meeting Copilot V0.7

**Atualização:** 2026-11-02. **Marco:** M0 — fundação + viabilidade Swift.
**Implementação concluída:** **T001**. Manutenção documental posterior registrada abaixo; nenhuma tarefa seguinte iniciada.

## Reorganização da documentação — 2026-11-02

- A pedido do usuário, nove documentos de planejamento e acompanhamento foram movidos da raiz para `docs/`. `README.md` e `AGENTS.md` permanecem na raiz como entrada do projeto e instruções para todo o repositório.
- Atualizados links, caminhos nas instruções, árvore de diretórios, `.prettierignore` e runner Python para ler `docs/TASKS.md` e gerar prompts com os novos caminhos.
- Validação: 16 links Markdown locais existentes; 39 tarefas com IDs, estados e dependências preservados; referências do prompt válidas; `--dry-run` na raiz e fora dela identificou T002 sem executá-la; sintaxe Python verificada.
- `npm run verify` passou novamente (lint, formatação, tipos, 12 testes e build). Permanece o aviso esperado de preload ausente da T001. Smoke gráfico não repetido: esta manutenção altera documentação e caminhos do runner, sem mudança no app.

## Entrega T001

- Estado inicial: documentos + runner Python, sem app e sem Git. Criada branch local `main` e commit base `1ee43a4` (`chore: initialize meeting copilot planning`).
- Electron + React + TypeScript strict: lifecycle em `src/main/index.ts`, janela/URL local em `src/main/app`, shell em `src/renderer/app`. Tela `DEMO` informa que transcrição/sugestões ainda não estão disponíveis; captura e IA inativas.
- Renderer sem Node/IPC exposto; contextIsolation, sandbox e webSecurity ativos; permissões, popups e navegação bloqueados; sessão em memória; CSP sem conexões no build. Dev limitado a `127.0.0.1:5173` com exceções CSP para HMR.
- Configurados electron-vite, ESLint com tipos/React Hooks/imports, Prettier, tsconfigs separados, Vitest/RTL e Playwright. Scripts npm, lockfile, `.editorconfig`, `.nvmrc`, testes, README e ADR 0001 documentam execução e limites.
- Domínio/adaptadores/Swift e preload/contratos serão criados com suas implementações. T003 ainda precisa implementar IPC, schemas e testes completos de fronteiras.
- `.azul-engai` foi gerado pelo ambiente durante a sessão e entrou no commit base; retirado do índice nesta entrega e ignorado, preservando o arquivo local.

## Ambiente e verificações executadas

Mac: **macOS 26.6.2 (25G83)**; `xcode-select -p`: `/Applications/Xcode-26.6.0.app/Contents/Developer`. Isso não valida APIs Speech ou SDK Swift.
Terminal inicialmente em Node 20.20.2/npm 10.8.2. Selecionado Node **26.0.0**/npm **11.12.1** já instalado em `/opt/homebrew/bin`, com `export PATH=/opt/homebrew/bin:$PATH`, sem alteração global.

| Verificação                                                      | Resultado observado                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci --ignore-scripts --offline --no-audit`                   | Instalação limpa pelo lockfile passou usando cache local; 268 pacotes.                                                                                                               |
| `node node_modules/electron/install.js`                          | Binário oficial Electron 45.2.1 instalado; repetição após `npm ci` passou pelo cache.                                                                                                |
| `npm run verify`                                                 | Passou: lint, Prettier, 3 tsconfigs strict, 12 testes em 2 arquivos e build main/renderer.                                                                                           |
| `npm run test:smoke`                                             | Passou: 1 teste abrindo/fechando Electron real; tela, ausência de Node/IPC no renderer, CSP, recarga sem HTTP(S) e bloqueio de popup.                                                |
| `env -u ELECTRON_RUN_AS_NODE npm run dev -- --clearScreen false` | Servidor e app iniciaram. Checagem adicional Playwright confirmou heading/DEMO, URL loopback e recarga sem erros de página. Servidor encerrado com Ctrl+C e janela de teste fechada. |
| Auditoria de dependências                                        | Instalação final reportou **0 vulnerabilidades** após correção transitiva; sem `audit fix --force`.                                                                                  |
| Inspeção visual                                                  | Imagem da janela obtida pelo smoke e inspecionada; sem corte do conteúdo no tamanho inicial. Artefato local ignorado: `test-results/startup.png`.                                    |

O smoke executou fora da sandbox para acesso ao desktop. Corrigida a herança de `ELECTRON_RUN_AS_NODE` no ambiente do teste; nenhum ajuste global. A primeira recarga dev ocorreu durante a navegação inicial e falhou; a verificação final aguardou o conteúdo e passou.

O build emite `preload config is missing`, esperado e não silenciado: preload pertence à T003. Playwright emitiu aviso de `NO_COLOR`/`FORCE_COLOR` herdados do host, sem efeito no resultado. Incompatibilidade de tipos Vitest 5/jest-dom resolvida fixando Vitest 4.1.12; `skipLibCheck` permaneceu `false`. Justificativas no [ADR 0001](adr/0001-desktop-scaffold.md).

## Limites e pendências

- T001 prova scaffold e abertura local. **Não há** captura, transcrição Swift, OpenAI, JSONL, screenshots do produto ou jornada demo com mocks. Nenhuma chamada paga, chave, áudio de reunião ou concessão de permissão TCC foi usada.
- Não executados: `swift test`, SwiftLint/SwiftFormat, avaliação de idiomas/assets, mic/system, empacotamento, assinatura, Windows ou teste manual humano da reunião. Ainda não existe pacote Swift.
- T002 permanece `TODO`: revisar/ampliar gates, definir tooling Swift/limitações e CI. T003 permanece `TODO`: IPC tipado e testes de fronteiras. Não foram concluídas por antecipação.
- Nenhum bloqueio remanescente da T001. Próxima sessão recomendada: **T005**, conforme `docs/PROMPT-CODEX.md`. T002/T003 também elegíveis; o runner seleciona T002 pela ordem da tabela. Operador deve escolher em **nova sessão**. Windows T036–T039 permanece `DEFERRED`.

## Commit e retomada

Entrega do scaffold: `80a5d67` — `feat(T001): scaffold Electron and React`, contendo código, testes, lockfile e registro inicial. Commit base: `1ee43a4`. A reorganização documental é registrada em commit posterior `docs(T001): move planning documentation into docs`. Nenhum push ou remoto criado.

Na próxima sessão, reler documentos obrigatórios, comparar `git status/log` e `docs/TASKS.md`, escolhendo somente uma tarefa. A evidência exploratória externa de STT em `docs/REFERENCIA-STT-APPLE.md` não comprova o Swift próprio.
