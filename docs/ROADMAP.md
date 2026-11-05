# Roadmap — Meeting Copilot

**Decisão confirmada em 2026-11-02:** A aplicação macOS implementará **sua própria captura/transcrição em Swift** utilizando `SpeechAnalyzer`/`SpeechTranscriber` e `ScreenCaptureKit`, com integração segura ao Electron + React. **Não incorporar, invocar nem empacotar CLIs de STT externas no MVP.** Windows permanece uma fase posterior. Marcos não são estimativas de prazo.

| Marco | Entrega verificável | Tarefas | Escopo |
| --- | --- | --- | --- |
| **M0 — Base e viabilidade Swift** | Electron seguro **modular, lint/typecheck/format/test/build** + POC Swift independente: hardware, idiomas/assets, permissões, mic e áudio do sistema em Mac real | T001–T006 | MVP |
| **M1 — UI e demo** | Overlay com início/pausa/parada, consentimento e fluxo simulado sem API | T007–T011 | MVP |
| **M2 — Swift nativo ↔ Electron** | `AppleNativeTranscriptionProvider` chama **binário Swift próprio**, recebe eventos JSONL de mic/system, gerencia PT / PT+EN, estados, erros e parada | T012–T019 | MVP |
| **M3 — Sugestões inteligentes** | Contexto, OpenAI, gatilhos, integração fala→IA→overlay, orçamento e validação | T020–T027 | MVP |
| **M4 — Screenshots e privacidade** | Captura autorizada, análise visual, proteção testada da janela | T028–T031 | MVP |
| **M5 — Qualidade e entrega Mac** | Segurança, empacotamento do helper Swift próprio, assinatura/permissões, testes reais, documentação | T032–T035 | MVP |
| **M6 — Estudo de Windows** | Investigar provedores de captura e STT Windows, desenhar adaptação, POC e planejamento | T036–T039 | **FUTURO — DEFERRED** |

## Evidência real obtida — **fora do aplicativo**
- Usuário testou STT Apple local por uma POC no Terminal do Mac: transcrição em `pt-BR`, com pontuação adequada, e captura de microfone + áudio do computador.
- Usuário testou `pt-BR,en-US`: alternância teve confusões pontuais; estimativa subjetiva de **~80%**, sem amostra controlada ou métrica de precisão formal.
- A experiência valida **viabilidade preliminar da tecnologia Apple**, não o SDK Swift escrito por nós, nem o JSONL próprio, nem Electron, assinatura, permissões do nosso app ou precisão bilíngue da nossa implementação.

## Como usar este roadmap

O roadmap resume marcos e escopo; tarefas/dependências e critérios verificáveis estão em [TASKS.md](TASKS.md). Padrões e gates de engenharia estão em [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md), o fluxo de sessão/commit em [WORKFLOW.md](WORKFLOW.md), e o resultado atual em [PROGRESS.md](PROGRESS.md). Windows (M6, T036–T039) continua `DEFERRED` até nova decisão.

Referências técnicas: [Apple SpeechAnalyzer](https://developer.apple.com/documentation/speech/speechanalyzer), [SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber), [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos) e [referência exploratória](REFERENCIA-STT-APPLE.md).
