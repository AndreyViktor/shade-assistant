# ADR 0007 — POC de áudio Swift independente, com teste manual

Data: 2026-11-04. Tarefa: T006. Estado: aceito para a POC; captura real pendente.

## Contexto

O diagnóstico T005 não captura nem instala assets. O usuário autorizou implementar a POC e preparar modelos Apple, inclusive eventual download, mas reservou a concessão TCC e a execução de captura para um teste humano. Precisamos chegar a um executável testável antes dessa intervenção. T012–T014 ainda definirão protocolo e integração Electron.

## Decisão

- Adicionar `MeetingCopilotAudioPOC`, executável Swift próprio separado do diagnóstico e do futuro helper de produção. Sem dependências externas. Bundle local ad hoc, com identificador estável e descrições de uso em `Info.plist`. Não é distribuição/notarização nem prova da identidade TCC final do Electron.
- `--prepare-assets` resolve um único locale, reserva via `AssetInventory`, solicita instalação quando a API oferece um request, verifica `installed`, prepara/cancela o analyzer sem áudio. A reserva permanece no contexto do app para os próximos ensaios; não liberar idiomas de outros apps nem remover modelos para abrir espaço. Não consulta fontes nem solicita TCC.
- Captura exige `--capture --source mic|system|both` e terminal interativo de entrada/saída. Sem argumentos, apenas ajuda. Microfone por `AVAudioEngine`, permitindo ensaio sem autorização de tela; sistema por `SCStream`/ScreenCaptureKit com saída `.audio`, sem handler de imagens. Não há gravação, preview de tela ou APIs de rede no código da POC; o serviço de assets Apple pode usar rede.
- Cada fonte tem seu próprio transcritor, analyzer, conversor, sequência e relógio de amostras. Um locale por execução: pt-BR prioritário; en-US opcional separado se suportado. Não oferecer mistura PT+EN nem identificar pessoas a partir da fonte.
- Conversão PCM por fonte para o formato negociado com SpeechAnalyzer. Callbacks síncronos protegidos por lock; os dois `@unchecked Sendable` encapsulam somente estado protegido e empréstimo de buffer durante a conversão síncrona. Buffers publicados são novos e imutáveis após a transferência. Fila limitada a 32 buffers; overflow encerra o ensaio com erro em vez de descartar áudio silenciosamente.
- `p` encerra captura/analyzers e suprime resultados; `r` cria novos canais e incrementa `segment`; `q`/Ctrl-C encerra. Pausa/parada descartam hipóteses pendentes, sem flush que gere fala após a parada. Todos os canais são limpos mesmo quando um falha. Falhas operacionais retornam códigos constantes, nunca descrição do erro Apple.
- Saída de diagnóstico `trialVersion: 1`, com fonte, locale, segmento, timestamp de entrega e intervalo relativo de áudio. Texto omitido por padrão; `--show-text` permite somente exibição local deliberada de frases sintéticas. Não é contrato JSONL de T012: inclui ajuda textual, não é consumido pelo Electron e não promete ordenação global das fontes.
- Encerrar automaticamente após 120 s de sessão; limite de processo de 180 s em captura / 600 s em preparação de assets. Ctrl-C/SIGTERM tenta limpeza e força saída após 8 s se serviço do SO travar. Saída forçada não conta como teste de parada bem-sucedido.

## Alternativas e consequências

ScreenCaptureKit também oferece microfone, mas exigiria acesso ao contexto de captura de tela para um teste só de mic. AVAudioEngine reduz esse acoplamento. A configuração SCK ainda seleciona um display; ausência de monitor/permissão é falha explícita. Não criar implementação bilíngue especulativa nem antecipar o helper de produção.

Os testes automatizados comprovam argumentos, privacidade da saída, conversão sintética, limite de fila e lifecycle com fakes. Não comprovam microfone, ScreenCaptureKit, qualidade/latência, prompts, eco ou identidade TCC. Bundle ad hoc executado pelo Terminal pode ser atribuído ao Terminal pelo macOS e requer validação humana. Não remover quarentena, executar `tccutil`, instalar drivers nem modificar permissões.

Fontes consultadas e assinaturas conferidas no SDK macOS 26.5 instalado: [SpeechAnalyzer/WWDC25](https://developer.apple.com/videos/play/wwdc2025/277/), [AssetInventory](https://developer.apple.com/documentation/speech/assetinventory), [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos). Procedimento e limites: [teste T006](../T006-SWIFT-AUDIO-POC.md).
