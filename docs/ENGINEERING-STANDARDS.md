# Padrões de engenharia e manutenção — Meeting Copilot V0.7

**Objetivo:** permitir que o Codex implemente o MVP sem transformar o projeto em um conjunto de arquivos gigantes, dependências circulares e código difícil de testar. Estas regras são obrigatórias para o código que ele produzir, mas **não exigem criar camadas ou abstrações vazias antecipadamente**. A menor solução que preserve os limites entre módulos é a preferida.

## 1. Decisões de arquitetura

- **Monólito desktop modular, não microserviços.** Electron é o host; React é apresentação; `core` concentra regras independentes de UI/SO; `infrastructure` contém integrações; Swift é o adaptador nativo do macOS.
- **Separação por responsabilidade + interfaces pequenas.** Preferir composição e injeção explícita de dependências (factory no `main`) a singletons globais, service locators ou frameworks de DI pesados.
- **Direção das dependências:** `core` não conhece Electron, React, Swift nem OpenAI; `infrastructure` implementa contratos necessários pelo `core`; `main` conecta implementações e controla o processo; `renderer` acessa apenas a API limitada do `preload` e os contratos públicos; `preload` não executa regras de negócio. O Swift conversa com o Electron **só pelo protocolo JSONL versionado**, nunca por importações diretas de código TS.
- **Organização por feature dentro do React.** Evitar pastas genéricas com centenas de componentes ou serviços. Arquivos de propósito único e nomes descritivos; dividir componentes grandes quando houver responsabilidades distintas, sem impor limite de linhas arbitrário.
- **Interface de provedor para STT** permite `AppleNativeTranscriptionProvider`, `MockTranscriptionProvider` e fallback autorizado sem condicionais espalhadas. Não criar providers sem caso de uso atual.
- **Apenas uma fonte de verdade** para estados de sessão/configuração, contratos e eventos; estado derivado deve ser calculado. Não duplicar schema ou enumerados independentes em cada camada.

## 2. Estrutura inicial alvo

Criar pastas de forma incremental (o repositório começa somente com documentação). Estrutura sugerida, sujeita a ajustes pequenos justificados em `docs/adr/`:

```text
meeting-copilot-codex/
  src/
    contracts/               # DTOs, tipos de IPC, schemas e protocolo JSONL
      ipc/
      native/
    core/                    # regras puras: sem Electron, React, Swift, HTTP
      meeting/               # sessão, estados, transcrição contextual
      transcription/         # interface TranscriptionProvider e normalização
      suggestions/           # trigger, ranking, dedupe, expiração
      budget/                # limites/estimativas sem chamadas de rede
    infrastructure/          # adaptadores: efeitos externos e mocks
      transcription/apple/   # integra helper Swift próprio; sem dependência de STT externo
      transcription/openai/  # fallback só opt-in
      transcription/mock/
      ai/                    # OpenAI, implementações de sugestões/visão
      settings/              # armazenamento seguro de configurações
    main/                    # Electron main; composição e orquestração
      app/
      ipc/                   # handlers e validação de entrada/autorização
      sessions/              # lifecycle de sessão/processos
      security/
    preload/                 # ponte mínima contextBridge, IPC allowlist
    renderer/                # React: feature-first
      app/                   # shell, providers UI, roteamento (se preciso)
      features/
        meeting/
        suggestions/
        settings/
      shared/ui/             # componentes visuais realmente reutilizados
  native/macos/
    Package.swift           # Swift Package Manager quando viável
    Sources/MeetingCopilotTranscriber/
      Capture/               # microfone, sistema, permissão e streams
      Transcription/         # SpeechAnalyzer, locale e hipóteses
      Protocol/              # JSONL e comandos do processo
      App/                   # composition root e lifecycle nativo
    Tests/                   # Swift Testing ou XCTest
  tests/
    integration/             # IPC, JSONL parser, spawn, sessão e mocks
    e2e/                     # smoke Electron/renderer, sem APIs pagas
  docs/                     # planejamento, padrões e acompanhamento
    adr/                    # decisões arquiteturais curtas e datadas
    ARCHITECTURE.md
    ENGINEERING-STANDARDS.md
    TASKS.md
    PROGRESS.md
  scripts/                  # automações reproduzíveis de verificação
  AGENTS.md                 # instruções para todo o repositório
  README.md                 # entrada e execução local
```

**Colocação dos testes:** testes unitários TS/React próximos ao arquivo (`*.test.ts(x)`) quando facilitarem manutenção; `tests/integration` e `tests/e2e` para fluxo entre módulos. Testes Swift em `native/macos/Tests`. **Nunca** importar `src/main` ou `src/infrastructure` diretamente no `renderer`; nunca importar React/Electron em `core`. `contracts` não importa implementações.

## 3. Estilo, nomenclatura e simplicidade

- TypeScript `strict: true`, `noUncheckedIndexedAccess` e `useUnknownInCatchVariables` quando compatíveis com o scaffold. Não introduzir `any`, `// @ts-ignore`, `eslint-disable` ou force unwrap (`!`) sem justificativa local documentada; validar `unknown` nas fronteiras.
- Preferir funções pequenas, nomes autoexplicativos, early return, estados discriminados e tratamento explícito de falhas. Não adicionar abstração só por estilo; extrair código **quando existe reutilização real ou limite de responsabilidade claro**.
- TS/React: componentes em `PascalCase`, hooks `useX`, funções/variáveis `camelCase`, tipos/interfaces `PascalCase`, constantes verdadeiramente estáveis `UPPER_SNAKE_CASE`, arquivos consistentes com convenção adotada; nome de arquivo deve refletir o export principal. Usar `type`/`interface` com consistência, sem dogmatismo.
- React: lógica de negócio fora de componentes, efeitos canceláveis, estado mínimo, hooks para composição. Não colocar chamadas OpenAI, acesso Node ou leitura direta de arquivos no renderer.
- Swift: tipos `UpperCamelCase`, membros `lowerCamelCase`, `async/await`, cancelamento explícito e isolamento de concorrência. Não manter áudio/streams ativos após `stop`; gerenciar permissões e recursos com escopo definido.
- Evitar classes `Utils`, `Manager` ou `Service` sem responsabilidade clara; proibir módulos "god object", dependências circulares, códigos duplicados e comentários que apenas repetem o código. Documentar **por que** uma solução existe, não o óbvio.
- Tipos e schemas de mensagens na borda são versionados; não aceitar dados de processo/IPC/rede sem validação de runtime. Normalizar erros para mensagens seguras e códigos internos, jamais exibir token, payload de reunião ou stack sensível ao usuário.

## 4. Ferramentas e comandos de qualidade

**Node:** usar `npm` e **um único lockfile `package-lock.json`** para facilitar reprodução. No scaffold, instalar e configurar versões compatíveis, sem supor que estão disponíveis antecipadamente.

- **ESLint** com `typescript-eslint`, regras React/React Hooks quando aplicável e tratamento de imports; erros de lint bloqueiam conclusão. Proibir variáveis não usadas, hooks incorretos e promessas soltas. Considerar regra de fronteiras de módulos conforme configuração viável.
- **Prettier** com configuração compartilhada; evitar debates manuais de formatação. Adicionar `.editorconfig` (UTF-8, LF, newline final) e `.prettierignore`.
- **TypeScript:** `tsc --noEmit` para tipos de core/main/preload/renderer, com tsconfigs separados caso necessário; não suavizar `strict` para contornar erro.
- **Testes TS/React:** Vitest e React Testing Library; fake timers e mocks determinísticos; verificar saída e falhas, não detalhes de implementação. **E2E:** Playwright ou mecanismo equivalente adequado ao Electron, após existir UI executável.
- **Swift:** usar Swift Package Manager/`swift test` quando viável. Selecionar SwiftLint/SwiftFormat como ferramentas nativas, travando versões/configuração; antes de exigir executáveis no pipeline, confirmar disponibilidade/instalação autorizada no Mac. Não fingir que rodaram fora do macOS.
- Criar scripts npm abaixo (nomes estáveis; podem apontar para tarefas agregadas) e documentar os comandos exatos em `README.md`. `verify` deve parar no primeiro erro e **não efetuar chamadas externas pagas**:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
npm run verify        # agrega lint + format:check + typecheck + test + build
# no macOS, quando o pacote nativo existir:
cd native/macos && swift test
# e lint/format Swift conforme ferramentas disponíveis e documentadas
```

- Usar testes em CI (por exemplo GitHub Actions), **sem exigir conta, push ou deploy** para validação local. CI genérico pode rodar TS no runner apropriado; jobs de Swift/macOS dependem de runner macOS e SDK compatível. Não adicionar cache/secret inseguro para acelerar.

## 5. Estratégia de testes (por responsabilidade)

- **Core:** testes unitários de transição de estados, cooldown/trigger, dedupe, ordenação, budget e cancelamento. Alvo inicial: cobertura **>= 80% em `core`** quando houver volume suficiente para relatório representativo, sem usar métrica isolada como prova de qualidade; testar explicitamente todos os fluxos críticos.
- **Contratos:** testes de compatibilidade e validação `IPC/JSONL`, dados inválidos, tamanho máximo, mensagens duplicadas/reordenadas, versão desconhecida, saída incompleta, erros e timeouts.
- **Electron main:** integração com helper **falso** que emite JSONL predefinido; encerramento sem processos órfãos; nenhuma credencial no renderer; controles de pausa/stop impedem eventos tardios. Testes de bridge não substituem POC real no Mac.
- **React:** testes de componentes e acessibilidade de botões/estados de erro; smoke e2e da jornada mock offline, sem OpenAI.
- **Swift:** testes de serialização/protocolo, estados, cancelamento e simulações de captura. A captura real mic/system e o reconhecimento Apple exigem **teste manual em Mac compatível**, documentado separadamente; nunca marcar a partir de mock.
- **Integração OpenAI:** mocka resposta em testes locais; testes reais só com consentimento, chave segura, custos e rede autorizados. Nenhuma chamada paga em teste unitário ou `verify`.
- **Privacidade e segurança:** logs sem fala/áudio/chaves, captura somente autorizada, consentimento e permissão reversíveis; testar erros e cleanup; tratar como critérios funcionais, não só lint.

## 6. Versionamento, dependências e evolução

- Dependências JS/Swift devem ter finalidade explícita e versões reprodutíveis; evitar adicionar biblioteca para substituir poucas linhas legíveis, especialmente em código de segurança. Não instalar dependências desconhecidas sem inspeção; não ativar `postinstall` inseguro.
- Mudanças de contrato/IPC/JSONL precisam de **schema atualizado + teste de compatibilidade + consumidor adaptado** na mesma tarefa. Externar versionamento de protocolo e erros de versão claros; não ignorar eventos desconhecidos silenciosamente quando puderem indicar incompatibilidade.
- **ADR curto** em `docs/adr/` para escolhas que mudem fronteiras, ferramenta fundamental, modelo de concorrência, protocolo, persistência, fornecedor de API ou política de segurança. Formato: contexto, decisão, alternativas, consequências, data. Não exigir ADR para mudanças triviais.
- Preferir commits locais por entrega pequena, com descrição informativa; não reformatar o projeto inteiro por uma alteração pontual; sem `push` sem autorização.
- Comentários/TODO devem apontar contexto ou tarefa identificada; evitar código comentado, flags mortas e duplicidade de funções.

## 7. Definition of Done (obrigatória para cada tarefa)

Uma tarefa só pode ir para `DONE` quando, conforme o escopo dela:
1. Implementação mantém dependências na direção definida e tem interfaces/nomeação claras; sem warnings relevantes ou erros suprimidos silenciosamente.
2. Rodaram com resultado registrado `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test` e `npm run build` (ou `npm run verify` que os englobe) **quando os scripts já existirem**. Em tarefa inicial de scaffolding, registrar precisamente o que não foi possível executar e por quê.
3. Há testes automatizados da lógica/contrato alterado e, quando exigido, teste manual de hardware com evidência. Teste manual não executado **não** vira teste concluído.
4. Logs não vazam chaves nem transcrição; modos offline não enviam rede; resultados de mock são explicitamente identificados como mocks.
5. `docs/TASKS.md` e `docs/PROGRESS.md` refletem testes, arquivos afetados, limites, decisão e próximo passo. Mudança arquitetural relevante possui ADR.

**Não contornar um gate apagando o teste ou desabilitando a regra.** Se não houver macOS/permissões/API, marcar a parte dependente de ambiente como `BLOCKED` com instrução, continuar tarefa independente elegível. Se erro for preexistente, documentá-lo e corrigir de forma focada; não declarar aprovação falsa.

## 8. Regras anticomplicação

- Não criar monorepo com vários pacotes JS, microserviços, filas externas, CQRS/event sourcing, ORM ou infraestrutura de nuvem **sem necessidade demonstrada**.
- Não introduzir Redux, Zustand ou outra lib de estado sem provar que o estado local/hooks/contexto são insuficientes. Não instalar um UI kit grande sem benefício concreto.
- Não criar wrappers genéricos para a API OpenAI, ou abstrações para abstrações: manter adapters pequenos com testes. Não duplicar contratos no Swift e TS sem validação de compatibilidade.
- Performance otimizada após métricas de CPU, memória, latência, não por suposição. A arquitetura pode evoluir, mas sempre com alteração pequena, evidência e documentação.

## Fluxo Git/contexto complementar
- Seguir também `docs/WORKFLOW.md`: cada tarefa concluída deve ter commit local com `Txxx`, e sessão nova na tarefa seguinte. `npm run verify` e testes Swift aplicáveis são gates de engenharia, não substituídos por commits ou pelo runner.
- O runner `scripts/run-codex-tasks.py` não é parte do aplicativo Electron/Swift; é uma automação **opcional de desenvolvimento** em Python stdlib. Testes do runner não substituem testes do produto.
