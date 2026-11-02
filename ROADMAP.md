# Roadmap — Meeting Copilot V0.7 (Swift nativo, arquitetura sustentável)

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

## Gates permanentes de engenharia
- `ENGINEERING-STANDARDS.md` é normativo: estrutura modular simples, limites de import, ESLint, Prettier, TypeScript strict, testes TS/React e Swift, scripts `npm run verify`, revisão de dependências e ADRs relevantes.
- T001–T003 estabelecem o padrão **antes** de aumentar o código; todos os outros marcos herdam os gates. Regressão de qualidade é bloqueio da entrega, não dívida invisível.
- Evitar complexidade desnecessária: não impor microserviços, frameworks extras ou infraestrutura de nuvem para um aplicativo desktop.

## Gates e sequência técnica
1. **T005:** no Mac de desenvolvimento, confirmar compatibilidade, `SpeechTranscriber.isAvailable`, `supportedLocales`/`installedLocales`, `AssetInventory`, permissões e ferramentas Swift/Xcode.
2. **T006:** desenvolver POC Swift independente que capture áudio de mic e sistema via mecanismos Apple; usar `SpeechAnalyzer`/`SpeechTranscriber`, streaming e eventos anotados por fonte. Testar idioma único; testar bilíngue com cuidado. Verificar que `SpeechAnalyzer` aceita uma sequência de entrada por vez: separar canais e estados de análise.
3. **T012–T014:** definir contrato tipado de eventos, implementar **helper próprio**, integrá-lo ao main do Electron por `spawn` (`shell:false`) e canal JSONL/IPC. Um processo Swift separado é **proposta de engenharia**.
4. **T017–T019:** fazer texto chegar à UI em tempo real; testar pause/stop/quit, falhas e autorizações em ambiente real.
5. **T032–T035:** avaliar empacotamento, permissões TCC, `Info.plist`, assinatura/notarização, distribuição do helper nativo e sessões prolongadas.

## Regras
- Implementar M0–M5 agora. M6 Windows é `DEFERRED` e **não bloqueia o MVP no Mac**.
- Repositórios públicos podem ser consultados apenas como **referência de implementação**, nunca como dependência de runtime nem evidência de que o Swift próprio funciona. Ver `docs/REFERENCIA-STT-APPLE.md`.
- No modo Apple local, áudio permanece no dispositivo; **texto** usado para sugestões e screenshots confirmadas ainda poderão ser enviados à OpenAI conforme autorização. STT OpenAI remoto exige consentimento específico e pode gerar custos.
- `DONE` exige resultado verificável; quando hardware/permissões não estiverem disponíveis, registrar `BLOCKED` e prosseguir com tarefas independentes.

Referências: https://developer.apple.com/documentation/speech/speechanalyzer · https://developer.apple.com/documentation/speech/speechtranscriber · https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos · `docs/REFERENCIA-STT-APPLE.md` (POC e referência opcional)

## Sequência de implementação isolada (V0.7)
- Marcos e dependências permanecem inalterados. Cada `Txxx` é tratada **numa sessão Codex nova**, concluída com testes, atualização de `TASKS.md`/`PROGRESS.md` e commit local com ID. Sessões posteriores usam o estado no Git/arquivos, sem reutilizar histórico. Ver `WORKFLOW.md`.
- A execução multi-tarefa automática, quando desejada, deve passar por um **executor externo limitado** (`scripts/run-codex-tasks.py --max-tasks N`) que valida a conclusão antes de criar a próxima sessão. Padrão `N=1`.
