# Roadmap — Meeting Copilot

**Decisão técnica confirmada em 2026-11-02:** A aplicação macOS implementará **sua própria captura/transcrição em Swift** utilizando `SpeechAnalyzer`/`SpeechTranscriber` e `ScreenCaptureKit`, com integração segura ao Electron + React. **Não incorporar, invocar nem empacotar CLIs de STT externas no MVP.** Windows permanece uma fase posterior. Marcos não são estimativas de prazo.

**Prioridade de produto confirmada em 2026-11-17:** a fase atual deve primeiro comprovar qualidade de áudio, transcrição, respostas e uso real; depois transformar a conversa em resultados estruturados ao vivo; por fim oferecer perfis reutilizáveis de reunião. Tradução, histórico/exportação, screenshots, integrações e ampliação de fornecedores permanecem visíveis, mas não competem com essa sequência.

| Marco | Entrega verificável | Tarefas | Situação |
| --- | --- | --- | --- |
| **M0–M2 — Base, UI e Apple local** | Electron seguro, demo, helper Swift próprio e transcrição mic/system integrada | T001–T019 | Base concluída; limites reais continuam documentados |
| **M3 — Sugestões inteligentes** | Contexto, OpenAI, gatilhos e integração fala→IA→overlay | T020–T027 | Núcleo concluído; avaliação T027 foi trazida para M10 |
| **M4 — Screenshots e privacidade visual** | Captura manual autorizada, análise visual e proteção testada da janela | T028–T031 | Fase posterior — `DEFERRED` |
| **M5 — Qualidade de entrega Mac** | Segurança, empacotamento, assinatura/permissões, regressão e documentação | T032–T035 | Após a experiência prioritária e seus pré-requisitos |
| **M6 — Estudo de Windows** | Investigar captura/STT Windows, desenhar adaptação, POC e planejamento | T036–T039 | Futuro — `DEFERRED` |
| **M7–M9 — Usabilidade do painel** | Painel compacto, preferências, contexto opcional e navegação de cartões | T040–T054 | Entrega principal concluída; itens residuais foram adiados |
| **M10 — Qualidade das respostas e uso** | Transcrição confiável, respostas avaliadas, resultados ao vivo e perfis de reunião | T055–T061 e T027 | **Fase atual** |

## Ordem executável da fase atual

1. **Fundação de qualidade — T056 → T057 → T027.** Remover eco/duplicação, medir e melhorar o STT local e então avaliar respostas e uso com corpus sintético ou autorizado. A avaliação cobre latência, utilidade, irrelevância, repetição, silêncio adequado, aderência às evidências e experiência do fluxo; não depende de fallback remoto, custo ou bilinguismo.
2. **Resultados estruturados ao vivo — T060.** Mostrar tópico atual, decisões, ações, perguntas abertas e riscos com referência à fala/horário e distinção entre fato e inferência. Ausência ou contradição deve ser representada sem inventar responsáveis, prazos ou decisões.
3. **Perfis reutilizáveis — T061.** Oferecer modos de reunião com objetivo e prioridades de sugestão, construídos sobre o contexto opcional consentido. Perfis orientam relevância, mas não são evidência do que aconteceu na conversa.

As dependências em [TASKS.md](TASKS.md) impõem essa sequência. T059 registra somente a reorganização documental.

## Direções posteriores

- **Contexto visual:** T028–T031 continuam previstos com screenshot exclusivamente manual, prévia e confirmação; nada de captura automática.
- **Controles e continuidade:** T026, T045 e T049–T051 preservam idiomas, múltiplos monitores, histórico completo e controles separados. Tradução e exportação explícita devem receber tarefa e aceite próprios apenas quando forem repriorizadas.
- **Amplitude de plataforma e integrações:** novos fornecedores, análise local por LLM, MCP e integrações de produtividade exigem decisão explícita de escopo, privacidade e segurança; não são compromisso do MVP atual.
- **Entrega:** orçamento/fallback e a cadeia T032–T035 permanecem necessários antes de declarar o aplicativo pronto para distribuição.

## Evidência e limites atuais

- O usuário confirmou o fluxo real Apple local → contexto → OpenAI → cartões no aplicativo em T024; isso não comprova qualidade geral, custo ou sessão prolongada.
- A qualidade de respostas em reuniões ainda não foi avaliada sistematicamente e é responsabilidade de T027, após T056/T057.
- A alternância `pt-BR+en-US` teve apenas observação exploratória e permanece adiada em T026, sem alegação de precisão.

## Como usar este roadmap

O roadmap resume prioridade, marcos e escopo; tarefas/dependências e critérios verificáveis estão em [TASKS.md](TASKS.md). A numeração histórica dos IDs não define a próxima tarefa: valem estados e dependências atuais. Padrões e gates de engenharia estão em [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md), o fluxo de sessão/commit em [WORKFLOW.md](WORKFLOW.md), e o resultado atual em [PROGRESS.md](PROGRESS.md). Windows (M6, T036–T039) continua `DEFERRED` até nova decisão.

Referências técnicas: [Apple SpeechAnalyzer](https://developer.apple.com/documentation/speech/speechanalyzer), [SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber), [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos) e [referência exploratória](REFERENCIA-STT-APPLE.md).
