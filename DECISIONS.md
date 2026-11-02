# Decisões e premissas — V0.6 (2026-11-02)

## Confirmadas pelo usuário
- **D001:** Aplicação desktop multiplataforma em Electron + React + TypeScript.
- **D002:** Produto prioritariamente executável localmente; nuvem para hosting fora do escopo do MVP.
- **D003:** Escuta autorizada em tempo real, sugestões textuais contextuais e screenshots manuais.
- **D004:** Proteção do overlay durante screen share é desejada; sucesso depende dos capturadores e testes reais, particularmente macOS.
- **D005:** Codex desenvolverá o repositório guiado por Markdown; não construir orquestrador próprio inicialmente.
- **D006:** Preferência por **OpenAI API** para entendimento contextual e screenshots; transcrição remota é possível, mas não precisa ser o padrão.

- **D007 (2026-11-02):** **Transcrição local da Apple como padrão prioritário no Mac**, se compatível. OpenAI STT será fallback consentido. Validar Apple SpeechAnalyzer/SpeechTranscriber, idioma `pt-BR`, hardware e áudio do sistema por POC antes de implementação pesada.
- **D008 (2026-11-02):** Priorizar entrega/validação macOS inicialmente, mantendo Windows como alvo posterior.
- **D009 (2026-11-02; decisão atualizada):** O **MVP macOS terá transcrição Apple própria em Swift**, com `SpeechAnalyzer`/`SpeechTranscriber`, captura de microfone e áudio do sistema (`ScreenCaptureKit` quando apropriado) e ponte Swift↔Electron. Ferramentas externas de transcrição foram usadas somente para exploração, **não serão dependências do produto**.
- **D010 (2026-11-02):** Disponibilizar seleção de idiomas no início da reunião, com pt-BR ou pt-BR+en-US. A detecção simultânea teve erros ocasionais no teste manual.
- **D011 (2026-11-02; atualização):** Transcrição Swift própria faz parte **do MVP**, em M0 e M2. **M6 é reservado a Windows** e suas tarefas ficam `DEFERRED` até nova decisão do usuário. Não iniciar trabalho de Windows automaticamente.

- **D012 (2026-11-02):** O usuário explicitou prioridade por **código organizado e fácil de manter**, evitando que o desenvolvimento automatizado se torne confuso. Arquitetura, organização de pastas, lint, testes, conventions e padrões de qualidade serão especificados antes de começar a implementar.

## Propostas técnicas reversíveis (defaults a validar na implementação)
- **P001:** Criar **`MeetingCopilotTranscriber`**, helper Swift próprio com `SpeechAnalyzer`/`SpeechTranscriber` e captura de mic/sistema, que comunica eventos JSONL versionados ao `AppleNativeTranscriptionProvider` no Electron main (`spawn`, `shell:false`, IPC restrito). Protocolo e implementação são nossos. OpenAI STT é fallback remoto opt-in.
- **P002:** Sugestões de texto via Responses API, com modelo configurável escolhido após confirmação de disponibilidade, custo, latência e qualidade.
- **P003:** Análise de screenshot com um modelo com suporte a imagens na Responses API, configurável e verificado antes de integrar.
- **P004:** 0–2 sugestões curtas por evento; mostrar somente quando houver pergunta, objeção, compromisso ou comando manual.
- **P005:** Janela de contexto recente de 3–5 min + resumo, cooldown automático inicial ~10 s, expiração de sugestões ~30 s.
- **P006:** Histórico só em memória, sem áudio bruto gravado; demo sem chave API; idioma de sugestões PT-BR.
- **P007:** Modo BYO API key (o próprio usuário configura chave) no desktop; cofre de credenciais do sistema operacional; custo estimado e limite local por sessão.
- **P009:** Adotar `ENGINEERING-STANDARDS.md` como base: arquitetura modular sem microserviços, boundaries verificáveis, React organizado por feature, `core` isolado de infraestrutura, ESLint+Prettier+TS strict+Vitest/RTL e Swift Testing/XCTest, checks Swift no Mac, scripts `verify` e ADRs pequenos. Revisar escolhas de ferramentas se incompatibilidade comprovada, preservando qualidade.
- **P008:** Provedor STT selecionável e com detecção de compatibilidade; dados de áudio só saem no modo fallback autorizado. Mac primeiro, Windows depois; resultado de teste físico só se realmente realizado.

## Informação financeira verificada
- ChatGPT Plus/Codex por login **não incluem automaticamente consumo pago da API**. API tem cobrança própria, mesmo com mesma conta/e-mail.
- A oferta publicada de créditos promocionais ligada à assinatura abrange planos **Pro elegíveis e Business elegíveis**, e **exclui Plus**. Não assumir crédito de API sem verificar saldo real no painel API.
- O modo mock não requer pagamento/chave. Testes reais com API dependem de credencial e saldo, e custos precisam de consentimento explícito.

## Aberto para revisão humana (não bloquear tarefas independentes)
- **O001:** Estilo exato do copiloto, frequência ideal e política de prioridades das dicas.
- **O002:** Uma POC externa transcreveu mic/system e pt-BR com boa qualidade; modo pt-BR+en-US teve falhas (estimativa informal ~80%). **Pendente:** provar captura e STT no Swift **próprio**, avaliar detecção bilíngue sem pressupor paridade e testar Swift→Electron, permissões e distribuição.
- **O003:** Avaliações reais de qualidade/latência do STT local e dos modelos de sugestões, consumo de recursos e custo da API; otimização baseada em medição.
- **O004:** Regras de consentimento/privacidade aplicáveis a ambientes e reuniões específicos.
- **O005:** Definir versões mínimas macOS/hardware pela API realmente suportada, disponibilidade e instalação de idiomas, assinatura/notarização e permissões TCC do **helper Swift próprio**; validar UX de falha em Mac não compatível.

## Registro de revisão
- O plano V0.4 incluía uma premissa **superada** de usar um executável externo de STT no runtime e relegar Swift próprio para fase futura. Essa premissa foi substituída pela decisão de implementar Swift desde o início. POCs externas permanecem evidência exploratória, **não conclusão de tarefa do aplicativo**.

## Como agir
Codex pode alterar defaults técnicos reversíveis com justificativa e teste; não pode habilitar faturamento, comprar serviços, inserir credenciais, alterar permissões administrativas, instalar drivers ou publicar sem intervenção. Impedimentos nesses pontos são `BLOCKED` e outras tarefas elegíveis devem continuar.

## Decisões adicionais do usuário — V0.7 (2026-11-02)
- **D013:** Versionamento Git simples, branch `main` local, sem Git Flow sofisticado; **ao menos um commit por tarefa concluída** (idealmente um commit atômico), com ID da tarefa, testes e handoff no mesmo commit. Não fazer push remoto sem consentimento.
- **D014:** **Contexto novo para cada tarefa** Codex para evitar acúmulo; o histórico não é a memória do projeto. `TASKS.md`, `PROGRESS.md`, documentos, código e Git são estado persistido.
- **D015:** Para automação opcional, um executor mínimo em Python inicia **novos processos `codex exec`** por tarefa, valida estado/commit e encerra em erro/bloqueio. Não construir framework ou plataforma multiagente. A execução padrão é uma tarefa por chamada; avanço automático múltiplo é opt-in com `--max-tasks`.
