# Meeting Copilot — painel desktop e POC Swift

Scaffold executável de **Electron + React + TypeScript strict**, primeiro no macOS. A janela inicial exibe `DEMO`, captura inativa e IA desativada. Há um diagnóstico Swift independente de capacidades (T005) e uma POC própria de áudio (T006), validada em pt-BR no Mac pelo usuário; evidências e limites em `docs/PROGRESS.md`. Há controles de sessão (T008) e um roteiro DEMO determinístico de transcrição e cartões de sugestões (T009–T010), sem integração OpenAI ou helper de produção integrado ao Electron. A arquitetura de produto abaixo descreve as próximas entregas, não capacidades já disponíveis.

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

O build gera `dist/main`, `dist/preload` e `dist/renderer`. `npm start` abre esse build, sem servidor Vite. Ainda não gera instalador, assinatura ou pacote de distribuição (T034).

## Painel flutuante (T007)

Janela de 440 × 640, redimensionável até o mínimo de 360 × 400, sempre à frente de janelas comuns. Arraste pela barra de título e use o botão nativo amarelo para minimizar. No Mac, o menu **Janela** oferece **⌘M** (Minimizar painel) e **⇧⌘M** (Mostrar painel). Os atalhos pertencem ao app ativo; não são globais. Ative o app pelo Dock para restaurar o painel minimizado ou recriar a janela fechada. **⌘Q** encerra o app.

**Tab/Shift+Tab** navegam pelos controles; **Enter/Espaço** abrem ou recolhem Preferências. Dentro das preferências, **Esc** ou **Voltar ao painel** recolhem a seção e devolvem o foco ao botão. Rascunhos são preservados ao recolher. O menu **Exibir** permite ampliar o texto; o conteúdo rola verticalmente em janelas pequenas. O painel continua em DEMO, com falas e sugestões simuladas e sem captura real. Proteção em compartilhamento de tela pertence à T030, sem garantia de invisibilidade.

## Controles de sessão e consentimento (T008)

**Iniciar DEMO → Pausar → Retomar → Parar** exercita o estado de sessão pelo IPC real. Reproduz três falas fixas em pt-BR com fontes mic/sistema simuladas: abertura sem sugestão, pergunta sobre riscos e compromisso de levantamento. Cada fala aparece após 2 s e sua sugestão fixa (quando houver) após mais 1 s; a UI consulta o estado a cada 500 ms durante a reprodução ou enquanto houver cartões. Não captura áudio nem usa rede, chave ou API. A captura continua indicada como inativa. Pausa congela o roteiro; retomar reinicia o intervalo da etapa pendente. Stop limpa conteúdo e consentimentos; um novo início repete o mesmo roteiro. Só a fala atual, até dois cartões e uma memória limitada de deduplicação ficam em memória, sem persistência. Ao fim, use Parar e Iniciar DEMO para repetir. Os cartões mostram categoria, título, texto e fundamento; **Descartar** remove o cartão escolhido. Expiram em 30 s, inclusive durante pausa e após o fim do roteiro. Conteúdo repetido (normalização de caixa/espaços/Unicode) é suprimido até o prazo original, inclusive após descarte; stop limpa a supressão. Ver [ADR 0011](docs/adr/0011-session-suggestion-cards.md). Recarregar ou fechar a janela encerra a sessão, sem retomada automática. Falhas de comando mostram estado não confirmado e permitem tentar Parar.

Abra **Consentimento e dados enviados à nuvem** para consultar as modalidades: áudio local Apple, texto de contexto autorizado, áudio remoto opt-in com custo, e imagens confirmadas individualmente. Modos reais permanecem indisponíveis. Salvar preferências/chave não autoriza serviços. O core tem testes de bloqueio/cancelamento e descarte de resultados tardios com operações sintéticas; a prova de captura/envio real depende dos futuros adapters. Ver [ADR 0009](docs/adr/0009-session-lifecycle-and-consent.md).

## Preferências e chave (T004)

O painel salva modo, provedor STT e idiomas no perfil local do app. Padrão Mac: **DEMO**, **APPLE LOCAL (SWIFT)** como preferência e **pt-BR**. Salvar modo real ou idiomas bilíngues não inicia captura nem confirma suporte; integrações e validação Swift continuam pendentes. OPENAI STT permanece desabilitado até o fluxo de consentimento específico.

A chave é opcional. No Mac, **Importar chave pelo Mac** abre um seletor nativo para arquivo contendo somente a chave (até 4 KiB). O main cifra o conteúdo usando safeStorage/Keychain e grava apenas o ciphertext. **O arquivo original permanece no local escolhido**; remova-o manualmente se não for mais necessário. O renderer nunca recebe chave/ciphertext/caminho. **Remover chave armazenada** apaga o ciphertext do app. Nenhuma dessas ações faz chamada à API ou verifica a validade da chave. Falha no cofre impede a gravação, sem alternativa plaintext.

Em desenvolvimento não empacotado, `OPENAI_API_KEY` é reconhecida apenas no main, sem persistência e sem leitura de `.env`. Não coloque credenciais no repositório, comandos registrados ou frontend. Para removê-la, encerre o app, retire-a do ambiente e reinicie. Builds empacotados ignoram essa variável.

Arquivos: `preferences.v1.json` e `openai-key.enc` no `userData` do Electron. Preferências inválidas/versão desconhecida geram erro sem sobrescrita automática; para recuperar, encerre o app e mova somente o arquivo de preferências para backup. Após timeout, reabra para conferir se a operação terminou. Consulte o [ADR 0005](docs/adr/0005-settings-and-secrets.md) para contrato, proteção e limites. Código em `src/contracts/settings`, `src/infrastructure/settings`, `src/main/settings` e `src/renderer/features/settings`.

## Verificações disponíveis

| Comando                | Finalidade                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint com tipos, React Hooks, promessas e fronteiras dos seis módulos              |
| `npm run format:check` | Prettier; preserva os documentos normativos originais listados em `.prettierignore` |
| `npm run format`       | Formata os arquivos verificados                                                     |
| `npm run typecheck`    | TS strict separado para main, renderer e tooling, sem omitir checks das bibliotecas |
| `npm test`             | Vitest + RTL: contratos IPC, autorização, timeout, UI e fronteiras de imports       |
| `npm run build`        | Compila main, preload e renderer via electron-vite                                  |
| `npm run verify`       | Lint → formatação → tipos → testes TS/Python → build; para no primeiro erro         |
| `npm run test:smoke`   | Build + Playwright abre o Electron real; exige sessão gráfica local                 |

O smoke verifica dois cartões, descarte por teclado e expiração real durante pausa, além do roteiro DEMO com transcrição e sugestões, sem chave e com bloqueio/contagem de tentativas de rede no Node, Electron e sessões Chromium, além de início/pausa/retomada/parada pelo IPC, encerramento na recarga e rejeição de modos reais. Também verifica janela flutuante, minimização/restauração pelos comandos do menu, accelerators registrados, foco por teclado, redimensionamento e zoom de 200%. As teclas nativas do menu macOS não são emitidas pelo Playwright; os testes invocam os handlers reais do menu. Não é uma auditoria manual de VoiceOver. O smoke valida isolamento, API pública congelada, IPC real, argumentos inválidos, CSP, recarga sem HTTP(S), bloqueio de popups e preferências persistentes entre reinícios. No Mac também testa safeStorage/Keychain real com valor sintético, simulando somente a escolha do arquivo; não usa credencial real nem API. Pode exigir acesso à sessão gráfica/cofre pelo SO, sem automatizar aprovação. Perfil temporário e ambiente sem `OPENAI_API_KEY`; imagens do app de teste em `test-results/suggestions.png`, `test-results/demo.png`, `test-results/startup.png`, `test-results/settings.png`, `test-results/panel.png` e `test-results/panel-zoom.png`, ignoradas pelo Git. Não testa captura/STT/TCC. `verify` usa cifra simulada e não acessa o Keychain nem APIs pagas.

`tests/tooling/quality-gates.test.ts` também comprova que ESLint rejeita violações, que os três projetos TypeScript detectam erros strict e que Prettier rejeita formatação inválida. As configurações existentes continuam obrigatórias, sem supressões.

A regressão T011 acrescenta dois ciclos de **Iniciar → fala simulada → cartão → Pausar → Parar**, com uma etapa ainda pendente: verifica pausa estável, limpeza, ausência de eventos tardios e reinício sem cartões antigos. Usa relógio real do main e os controles da UI; não acelera o roteiro. Um smoke separado faz sete tentativas deliberadas em transportes Node/Electron para verificar os bloqueios e contadores, usando somente endereços loopback. Essas tentativas são esperadas nesse teste; os testes da jornada exigem contador zero. Isso não substitui monitoramento de tráfego do SO. A matriz de fronteiras cobre os 36 pares de camadas em arquivos aninhados de produto e teste, usando import, re-export, import type, import dinâmico e require. Para reproduzir a regressão:

```bash
npm run verify
npm run test:smoke
# Apenas a matriz de fronteiras:
npm test -- tests/tooling/module-boundaries.test.ts
# Apenas os novos e2e, após npm run build e com sessão gráfica:
npx playwright test tests/e2e/demo-regression.spec.ts tests/e2e/offline-guards.spec.ts
```

### Protocolo Swift ↔ Electron (T012)

Contrato próprio JSONL v1 e interface `TranscriptionProvider` em `src/contracts/native` e `src/core/transcription`. O target Swift `MeetingCopilotProtocol` serializa eventos e valida comandos; o parser TS valida eventos, sessão, sequência e estados por fonte. Framing UTF-8 incremental, linhas de até 16 KiB, EOF/truncamento e erros sem conteúdo bruto são cobertos por fixtures compartilhadas e testes nos dois runtimes. Especificação e limites: [ADR 0012](docs/adr/0012-native-jsonl-protocol.md).

```bash
npm test -- tests/integration/nativeProtocol.test.ts
npm run verify
npm run verify:swift
```

Esses testes são sintéticos, sem captura, TCC ou rede. O helper `MeetingCopilotTranscriber` e o adapter `AppleNativeTranscriptionProvider` ainda serão implementados/integrados em T013/T014; a interface não habilita STT real na UI. En-US é aceito como locale único no contrato, sem comprovar reconhecimento ou modo bilíngue.

### CI básico

[`.github/workflows/verify.yml`](.github/workflows/verify.yml) executa instalação pelo lockfile e `npm run verify` em Ubuntu 24.04, com Node de `.nvmrc`, em pull requests, push para `main` ou acionamento manual. Actions fixadas por SHA, permissão `contents: read`, sem credenciais persistidas, cache ou secrets. Não baixa o binário Electron nem abre janelas. Smoke gráfico e validação Apple ficam separados. O workflow foi preparado localmente; execução hospedada depende de publicação autorizada, não realizada nesta entrega. Decisões: [ADR 0002](docs/adr/0002-quality-gates.md).

### POC de áudio T006 — validação registrada

O executável próprio `MeetingCopilotAudioPOC` separa microfone/AVAudioEngine e sistema/ScreenCaptureKit, com um SpeechAnalyzer por fonte. Captura e transcrição pt-BR de mic/system, separadas e simultâneas, confirmadas pelo usuário; qualidade e latência não quantificadas. Não é o helper de produção nem está ligado ao Electron.

```bash
sh scripts/build-audio-poc.sh   # apenas compila e assina ad hoc o bundle local
python3 scripts/check-audio-poc.py   # checks sem captura, TCC ou rede
```

Para executar captura manualmente, siga o [roteiro T006](docs/T006-SWIFT-AUDIO-POC.md): permissões humanas, frases sintéticas, comandos exatos, pausa/parada e relatório sem conteúdo sensível. T006 está **DONE** no escopo da POC; veja as evidências e limitações em `docs/PROGRESS.md`. Não usar reuniões reais nem redirecionar transcrições para arquivos.

### Diagnóstico e gates Swift (T005)

Pacote próprio em `native/macos`, sem dependências externas, compilado com Xcode 26.6/SDK 26.5 e Swift 6.3.3 no macOS 26.6.2 arm64. `MeetingCopilotCapabilities` consulta APIs, pt-BR/en-US, assets e estado das permissões; constrói/cancela SpeechAnalyzer sem áudio. Não captura, solicita TCC, reserva assets ou baixa modelos. Emite um relatório JSON único, sem integração Electron/JSONL de transcrição.

```bash
npm run verify:swift   # swift-format + Swift Testing + build release (warnings como erros)
npm run probe:swift    # diagnóstico real; não faz parte dos testes unitários
```

`verify:swift` exige **swift-format 6.3.0**, fornecido pelo Xcode, e usa `native/macos/.swift-format`. SwiftLint/SwiftFormat não estão instalados; nenhuma instalação global foi feita. Manifest tools 6.2; SDK 26+ necessário para build. O CLI tem target macOS 14 e guarda de API para macOS 26; versões antigas/Intel não foram ensaiadas. CI Ubuntu continua executando apenas os gates JS/Python; mudanças Swift exigem também o gate nativo no Mac. Sandbox do agente pode restringir caches/serviços Apple: usar aprovação normal, sem alterar permissões.

Resultado histórico T005 (2026-11-03): `isAvailable = true`, pt-BR/en-US nas listas de suporte/instalação, mas `AssetInventory = supported` para ambos. Preparação de modelo não realizada: disponibilidade para captura não está comprovada. Microfone `notDetermined`, preflight de tela `false`, sem pedidos de acesso. Ver [relatório T005](docs/T005-SWIFT-CAPABILITIES.md), [evidência JSON](docs/evidence/T005-capabilities-2026-11-03.json) e [ADR 0006](docs/adr/0006-swift-capability-spike.md). Na retomada T006, os assets pt-BR foram instalados/preparados no bundle próprio sem captura; o ensaio posterior de mic/system e parada foi confirmado pelo usuário na conclusão da T006.

## Organização e limites

- `src/main/index.ts`: ciclo de vida Electron; `src/main/app`: criação da janela e validação do endereço local de desenvolvimento.
- `src/renderer/app`: shell React e estilos; `src/renderer/main.tsx`: montagem da UI. Não importa Node, main ou infraestrutura.
- `tests/e2e`: smoke do app real; testes unitários ficam junto do código; `tests/setup.ts` prepara RTL.
- `src/contracts/ipc`: schema versionado de estado público, validado nas duas pontas; `src/preload`: API fechada `getStatus/getSettings/savePreferences/importSecret/removeSecret/session`; `src/main/ipc`: allowlist e autorização por janela/frame/URL. Sem chaves, IPC genérico ou captura física; comandos de sessão aceitam apenas DEMO.
- `scripts/eslint/module-boundaries.mjs` e testes em `tests/tooling` verificam os limites entre os seis módulos, incluindo re-exports/imports dinâmicos e caminhos normalizados. `core` contém as regras de sessão e cartões; `infrastructure/transcription/mock` reproduz o roteiro DEMO. `native/macos` contém o diagnóstico T005 e a POC independente T006, conforme `docs/ENGINEERING-STANDARDS.md`.
- Janela com `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` e `webSecurity: true`; navegação, popups e permissões de captura bloqueados. CSP de produção não permite conexões; exceções para HMR existem apenas em desenvolvimento.

Escolhas de build, compatibilidade e correção transitiva de dependências: [ADR 0001](docs/adr/0001-desktop-scaffold.md).

Contrato IPC, allowlists, fronteiras e limites da T003: [ADR 0004](docs/adr/0004-ipc-and-module-boundaries.md).

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
