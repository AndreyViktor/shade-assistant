# T005 — Relatório real de capacidade Swift Apple

Executado em **2026-11-03**, no Mac de desenvolvimento, usando somente o código Swift deste repositório. Evidência estruturada: [T005-capabilities-2026-11-03.json](evidence/T005-capabilities-2026-11-03.json), coletada às **18:53:23 UTC** (15:53:23 em São Paulo). O JSON foi apenas formatado para o padrão do repositório.

## Ambiente observado

| Consulta                                | Resultado                                           |
| --------------------------------------- | --------------------------------------------------- |
| `sw_vers`                               | macOS 26.6.2, build 25G83                           |
| `uname -m`                              | arm64                                               |
| `xcode-select -p`                       | `/Applications/Xcode-26.6.0.app/Contents/Developer` |
| `xcodebuild -version`                   | Xcode 26.6, build 17F113                            |
| `xcrun --sdk macosx --show-sdk-version` | SDK 26.5                                            |
| `xcrun swift --version`                 | Apple Swift 6.3.3, swiftlang-6.3.3.1.3              |
| `xcrun swift-format --version`          | 6.3.0                                               |

O SDK instalado declara SpeechAnalyzer, SpeechTranscriber e AssetInventory disponíveis a partir do **macOS 26.0**. O manifest requer Swift tools 6.2; só a combinação acima foi compilada/testada nesta sessão. O executável de diagnóstico tem target macOS 14 e guarda de disponibilidade para apresentar fallback antes de 26; essa execução em macOS antigo/Intel **não foi ensaiada fisicamente**. A política de incompatibilidade tem testes sintéticos. Não foi determinada uma lista universal de modelos de Mac: consultar `isAvailable` em cada dispositivo.

## Resultado das APIs próprias

`SpeechTranscriber.isAvailable = true`. `supportedLocales` retornou **30 locales** e `installedLocales`, **11**; as listas completas estão no JSON.

| Verificação                                         | pt-BR            | en-US            |
| --------------------------------------------------- | ---------------- | ---------------- |
| Consta em `supportedLocales`                        | sim              | sim              |
| `supportedLocale(equivalentTo:)`                    | pt-BR            | en-US            |
| Consta em `installedLocales`                        | sim              | sim              |
| `AssetInventory.status(forModules:)`                | `supported`      | `supported`      |
| `SpeechAnalyzer(modules:)` + `cancelAndFinishNow()` | executados       | executados       |
| Preparação de modelo (`analyzer` no JSON)           | `notChecked`     | `notChecked`     |
| Avaliação conservadora                              | `assetsRequired` | `assetsRequired` |

**Não há comprovação de modelo pronto para uso.** Embora os locales constem na lista de instalados, o status por módulo não retornou `installed`. A documentação define `supported` como configuração suportada com assets ainda necessários; não inferimos a causa dessa divergência nem executamos download/reserva para encobri-la. Fonte: [AssetInventory.Status](https://developer.apple.com/documentation/speech/assetinventory/status/installed).

O diagnóstico só chama `bestAvailableAudioFormat` e `prepareToAnalyze` quando o locale está instalado **e** o status do módulo é `installed`. Neste Mac essas chamadas foram corretamente omitidas. Construção/cancelamento do analyzer comprova linkage/lifecycle básico da API; não comprova carregamento de modelo, reconhecimento, latência ou qualidade. Não houve audio input, mic, SCStream, arquivo de áudio ou transcrição.

## Permissões e contexto de execução

- Microfone: `AVCaptureDevice.authorizationStatus(for: .audio) = notDetermined`.
- Tela: `CGPreflightScreenCaptureAccess() = false`. Esse booleano não distingue recusa de ausência de solicitação e não comprova a autorização específica de uma futura captura somente de áudio por ScreenCaptureKit.
- Nenhuma chamada de request, diálogo TCC, aprovação automática ou captura foi feita. Os resultados pertencem ao contexto deste CLI iniciado pelo agente, não ao futuro bundle Electron/helper assinado.
- A autorização legada de `SFSpeechRecognizer` não foi usada como gate do SpeechAnalyzer. A Apple distingue essa autorização para reconhecimento em seus servidores dos módulos locais de SpeechAnalyzer: [Asking Permission to Use Speech Recognition](https://developer.apple.com/documentation/speech/asking-permission-to-use-speech-recognition?changes=_1). Permissão de captura e consentimento dos participantes continuam necessários na POC de áudio.

A primeira consulta **dentro da sandbox do agente** retornou `isAvailable = true`, listas vazias e microfone `denied`. Repetir fora da sandbox por aprovação normal revelou as listas e estados acima. Portanto, o resultado restrito não foi interpretado como incompatibilidade física. O SwiftPM também precisou de escalada para caches do toolchain; não foram alteradas permissões ou desabilitada sua sandbox.

## Reprodução e gates

Na raiz do repositório, com Xcode selecionado e Node 26:

```bash
npm run verify:swift
npm run probe:swift
# Alternativa após o build release do gate, sem recompilar:
native/macos/.build/release/MeetingCopilotCapabilities
npm run verify
```

`verify:swift` executa swift-format estrito, `swift test` e `swift build -c release`, com warnings como erros. Passaram **6 testes Swift**, incluindo testes parametrizados dos seis estados de assets e quatro resultados de preparação, precedência de incompatibilidade, inventário inconsistente, normalização de locale e JSON/fallback. Não acessam Speech/TCC. A execução real do CLI é evidência separada; saída 0 significa relatório obtido, não captura autorizada/pronta. Argumentos extras retornam 64, stdout vazio e `CAPABILITY_INVALID_ARGUMENTS`; verificado com `--capture` por subprocesso Python. Timeout/erro de encoding retornam 2; watchdog de 30 s não foi forçado no ensaio real.

## Fallback e próximos requisitos

| Situação                                          | Conduta do diagnóstico / orientação para integração futura                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| macOS anterior a 26 / device indisponível         | `requiresMacOS26` / `deviceUnavailable`; manter DEMO                                 |
| Locale não resolvido / configuração não suportada | `unsupportedLocale`; informar indisponibilidade                                      |
| Assets ausentes, baixando ou desconhecidos        | `assetsRequired`, `assetsDownloading` ou `assetStatusUnknown`; não preparar/capturar |
| Falha de preparação / formato ausente             | `analyzerUnavailable`; não declarar pronto                                           |
| Assets e preparação confirmados                   | `eligibleForCaptureTrial`; ainda exige permissões e ensaio de captura                |
| STT remoto                                        | somente autorização específica de áudio/custo; nunca acionado pelo diagnóstico       |

**T005 comprova o diagnóstico, incluindo limitações, e não a POC da T006.** Antes do ensaio de captura em uma nova sessão, resolver o estado dos assets no contexto do executável próprio, com autorização para eventual download, e obter permissões humanas para as fontes escolhidas. Validar mic/sistema separadamente; um analyzer aceita uma sequência de entrada por vez. pt-BR+en-US simultâneo, alternância, parciais, precisão, eco, streaming e ponte Electron continuam não validados. T006 não foi iniciada.

Referências consultadas em 2026-11-03: [SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber), [SpeechAnalyzer](https://developer.apple.com/documentation/speech/speechanalyzer), [preparação](<https://developer.apple.com/documentation/speech/speechanalyzer/preparetoanalyze(in:)>), [WWDC25](https://developer.apple.com/videos/play/wwdc2025/277/). Assinaturas conferidas também em `Speech.swiftmodule/arm64e-apple-macos.swiftinterface` do SDK 26.5 instalado. Tooling e limites arquiteturais: [ADR 0006](adr/0006-swift-capability-spike.md).
