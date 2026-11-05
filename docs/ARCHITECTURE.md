# Arquitetura técnica — proposta

## Objetivo
Esta é uma **proposta técnica**, não uma descrição de integrações já entregues. O documento cobre fluxo e fronteiras: o [PRD](PRD.md) é a fonte dos requisitos, [DECISIONS.md](DECISIONS.md) das decisões, [TASKS.md](TASKS.md) do aceite por tarefa, [PROGRESS.md](PROGRESS.md) das evidências atuais e [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md) das regras de implementação.

O alvo do MVP é Electron + React + TypeScript no macOS, com transcrição Apple local feita pelo projeto em Swift. OpenAI é opcional para sugestões/imagens autorizadas e fallback STT opt-in. Demo offline não faz chamadas pagas. Não usar executáveis externos de STT no produto.

## Fluxo principal
```text
Microfone / áudio do sistema (fontes autorizadas)
  -> helper Swift PRÓPRIO: MeetingCopilotTranscriber
       -> captura Apple (mic + ScreenCaptureKit, fontes segregadas)
       -> SpeechAnalyzer + SpeechTranscriber por canal/idioma suportado
       -> eventos JSONL do NOSSO protocolo versionado (stdout, comandos controlados)
  -> Electron main: AppleNativeTranscriptionProvider
       -> child_process.spawn(helper, args allowlisted, shell:false)
       -> parser JSONL seguro, sessões, relógios, limites e estados
  -> IPC validado / preload
  -> renderer React: transcrição (source=mic|system, idioma, horário)
  -> TranscriptBuffer + ContextManager (janela recente + resumo compacto)
  -> TriggerEngine (pergunta, objeção, compromisso, manual, silêncio)
  -> SuggestionProvider (OpenAI Responses API, modelo configurável)
  -> SuggestionStore (dedupe, expiração, invalidação)
  -> Overlay React (até 2 cartões)

Screenshot: atalho -> seleção/PRÉVIA -> confirmação explícita
  -> ScreenshotProvider -> OpenAI Responses API (modelo com visão configurável)
  -> cartão contextual no overlay
```

## Responsabilidades dos processos
- **Electron main:** controle de sessão e permissões; lançamento e encerramento do helper Swift **próprio**; leitura JSONL em streaming (`stdout`), stderr separado; validação de mensagens; sincronização/ordenação das duas fontes; APIs OpenAI autorizadas, cofre de segredos, orçamento, logs sem conteúdo sensível.
- **Preload:** API IPC mínima, tipada e validada (start/pause/stop, eventos, configurações não secretas, screenshot confirmado). `contextIsolation:true` e `nodeIntegration:false`.
- **React renderer:** controles e overlay, exibe `DEMO`, `APPLE LOCAL (SWIFT)` ou `OPENAI STT`, status de captura, origem, idioma, rede/custos; não conhece chaves ou rotas arbitrárias de sistema.
- **Swift `MeetingCopilotTranscriber`:** captura `mic` e `system` com APIs Apple, pede/observa permissões relevantes, faz STT local, normaliza eventos, gere lifecycle e libera streams ao pausar/parar. Verificar no macOS real a forma adequada de capturar áudio do sistema via `ScreenCaptureKit` e áudio de mic.
- **`SpeechAnalyzer` e idiomas:** um analyzer só processa uma sequência de entrada por vez; avaliar **instâncias separadas por canal**. `SpeechTranscriber` é configurado por locale; checar `isAvailable`, `supportedLocales`/`installedLocales` e `AssetInventory`. Para `pt-BR+en-US`, elaborar estratégia de múltiplos transcritores e seleção de hipótese com testes próprios. Se inviável, oferecer pt-BR apenas / troca manual segura.
- **`TranscriptionProvider`:** `start(config)`, `pause()`, `resume()`, `stop()`, eventos `ready/status/partial?/final/error/stopped`. **`AppleNativeTranscriptionProvider`** gerencia helper e parseia JSONL próprio com schema versionado. Eventos podem ser parciais apenas se a API/configuração os oferecer; não inventar eventos. **`OpenAIRealtimeTranscriber`** é fallback remoto somente após consentimento e orçamento; mock independente.
- **Protocolo próprio (esboço; validar):** eventos `{version:1,sessionId,seq,type,source,locale,timestamp,text?,isFinal?,errorCode?}`. Fonte em `mic|system`, `seq` monotônico por canal (identificar relógio/canal ao ordenar), timestamps normalizados, tamanho máximo por linha, validação estrita, stdout somente JSONL, stderr sem falas, backpressure/encerramento. Comunicação de comandos (`start/pause/resume/stop`) via stdin JSONL ou outro canal explícito; não misturar comandos com saída de eventos nem usar shell.
- **`ContextManager`:** conserva falas finais com origem/ordem, resumo e janela limitada de tokens; descarta conteúdos conforme opção; origem não identifica pessoa.
- **`TriggerEngine`:** regras/heurísticas + IA quando necessário. `none` em conversa trivial, cooldown e comando manual independente.
- **`SuggestionProvider`:** modelo OpenAI configurável com saída estruturada, 0–2 cartões; dedupe, cancelamento, timeouts e orçamento. Consultar modelos disponíveis na conta no momento da implementação.
- **`ScreenshotProvider`:** apenas solicitação manual + prévia/cancelamento + autorização; enviar imagem mínima ao modelo com visão configurável, jamais captura automática em background.
- **`UsageBudget`:** STT Apple local **não gera custo OpenAI de transcrição**, mas pode consumir CPU/bateria; contabilizar tokens/imagens e fallback remoto quando autorizado. Estimativas não são faturas.
- **`SecretStore`:** cofre OS/variável ambiente só para desenvolvimento; nunca localStorage/renderer/IPC genérico/Git/logs.

## Contrato sugerido das sugestões (schema de saída validado)
```ts
type Category = 'answer' | 'question' | 'warning' | 'action';
type Suggestion = {
  id: string;
  category: Category;
  title: string;
  body: string; // no máximo ~2 frases curtas
  groundedIn: 'meeting' | 'inference';
  expiresAt: string;
};
type SuggestionBatch = {
  trigger: 'question' | 'objection' | 'commitment' | 'manual' | 'none';
  suggestions: Suggestion[]; // 0..2, vazio em 'none'
};
```
Validar schema e limitações ao implementar; IDs e expiração podem ser adicionados localmente, se simplificar o output do modelo. Nenhuma confiança numérica inventada.

## Engenharia de prompts
Prompt do provider deve instruir: sugerir apenas quando relevante; não inventar fatos, números ou compromissos; apontar lacunas; evitar repetir cartões, priorizar 1–2 sugestões curtas em português; diferenciar fato observado vs inferência; usar screenshot **somente se aprovada**; nunca enviar mensagens por conta do usuário. Criar casos de avaliação sintéticos e registrar métricas.

## Modelos e transporte (defaults propostos)
| Função | Tecnologia | Critérios de validação |
|---|---|---|
| Transcrição macOS MVP | **Swift próprio:** `SpeechAnalyzer`/`SpeechTranscriber`, `ScreenCaptureKit` para áudio sistema | `isAvailable`, pt-BR, en-US/assets, TCC, mic/system, latência, consumo, protocolo/bridge e distribuição |
| Ponte nativa | **`MeetingCopilotTranscriber`** (helper Swift próprio, integrado com `child_process.spawn`) | JSONL nosso, schema/erros/cancelamento, binário assinado e distribuído pelo aplicativo |
| Transcrição remota opcional | OpenAI STT em tempo real, modelo **a confirmar na API** | Somente opt-in após aviso de custo/envio de áudio |
| Sugestões textuais | OpenAI Responses API / Structured Outputs, modelo **configurável** | Confirmar catálogo/conta, qualidade, custo, latência e schema real |
| Análise de screenshot | OpenAI Responses API + visão, modelo **configurável** | Validar suporte `input_image`, custo e disponibilidade |
| Demo/testes | Mocks determinísticos | Zero rede/cobrança, sem credencial |

Fontes `mic` e `system` **não identificam participantes**. O app não promete diarização nem timestamps por palavra; diferentes providers oferecem granularidades diferentes. A alternância bilíngue apresentou resultados mistos no teste exploratório e **precisa ser validada** na implementação própria.

## Aspectos de segurança, cobrança e privacidade
- O uso de APIs tem **faturamento separado** da assinatura ChatGPT Plus. Não ativar cobrança, comprar créditos ou criar chaves por conta do usuário.
- Com Swift/Apple STT local, **áudio permanece local**; texto contextual enviado à OpenAI e screenshots confirmadas **saem do dispositivo** quando IA real estiver ativa. No fallback OpenAI STT, áudio também sai, com consentimento separado. Indicação explícita do modo e pausa/parada. Não gravar áudio bruto nem screenshots por padrão; histórico em memória descartado ao encerrar.
- Se o orçamento estimado atingir o limite, interromper chamadas pagas e avisar sem continuar em loop. Estimativa de custo sempre mostrada como aproximada.
- `BrowserWindow.setContentProtection(true)` deve ser testado. No macOS, ScreenCaptureKit pode contornar proteção; não prometer ocultação universal nem adicionar técnicas furtivas.
- Tela compartilhada: não confundir **o usuário não ver o overlay no vídeo** com **o app não aparecer na captura**; provar por gravação/teste, conforme SO e modo de captura.
- IPC restrito, `contextIsolation: true`, `nodeIntegration: false`, sem `webSecurity: false`.

## Riscos e checkpoints antecipados
1. **Hardware, SDK e assets:** verificar em Mac real suporte a `SpeechTranscriber`, locales pt-BR/en-US e modelos instalados; documentar versão de macOS/Xcode efetivamente exigida. Não extrapolar compatibilidade a partir de POCs externas.
2. **Mic e áudio do sistema:** capturar fontes independentemente, definir permissão Screen Recording/áudio/mic aplicável; `ScreenCaptureKit` deve ser testado com Meet/Teams/Zoom e exclusão de áudio próprio. `SpeechAnalyzer` aceita uma sequência por vez.
3. **STT e bilinguismo:** criar/configurar transcritor por locale/canal e estratégia de seleção; testar pt-BR e PT+EN com falas reproduzíveis, sem prometer detecção perfeita. Oferecer modo único quando necessário.
4. **Bridge segura:** helper compilado por nós, protocolo JSONL versionado, validação, controle de processos/streams, sem vazamento em logs. Não invocar/empacotar executáveis de transcrição externos.
5. **Distribuição:** configurar bundle/assinatura/notarização/entitlements e TCC de helper próprio. Testar Mac recém-instalado; não desativar Gatekeeper.
6. **Dados e custos:** áudio permanece local com Swift STT; texto da reunião/screenshot aprovado podem ser enviados para sugestões via OpenAI. Remoto STT somente opt-in.
7. **Overlay:** proteção visual pode variar por capturador; testar tela/janela sem prometer invisibilidade universal.
8. **Windows:** tarefa futura fora do gate Mac.

## Fontes técnicas
- https://developers.openai.com/api/docs/guides/realtime-transcription
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/images-vision
- https://www.electronjs.org/docs/latest/api/browser-window
- `docs/REFERENCIA-STT-APPLE.md` (referência única do experimento exploratório e fonte de estudo opcional)

## Referências Apple
- https://developer.apple.com/documentation/speech/speechanalyzer
- https://developer.apple.com/documentation/speech/speechtranscriber
- https://developer.apple.com/documentation/speech/dictationtranscriber
- https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos
- https://developer.apple.com/videos/play/wwdc2025/277/
