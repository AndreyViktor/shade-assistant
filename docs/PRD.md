# PRD — Meeting Copilot

**Status:** requisitos de produto para validação; não representam funcionalidades já implementadas. **Alvo atual:** Electron + React + TypeScript, macOS primeiro. O MVP prevê transcrição Apple local implementada pelo projeto em Swift; OpenAI para sugestões/imagens autorizadas e STT remoto somente como fallback opt-in. Windows é futuro.

## 1. Problema e valor
Durante reuniões, o usuário precisa de ajuda **enquanto a conversa acontece**, não somente de resumos posteriores. O aplicativo deve ouvir fontes autorizadas, transcrever em fluxo, reconhecer o momento em que uma intervenção ajuda e exibir sugestões objetivas e relevantes sem distrair.

**Exemplo:** se um participante pergunta “Que riscos temos ao migrar esse módulo?”, o painel sugere até duas contribuições concisas e pertinentes ao contexto já discutido. Se a conversa for trivial, o painel permanece silencioso.

## 2. Público e escopo da primeira versão utilizável
- Profissional em reunião online (Google Meet, Zoom, Teams ou qualquer app compatível com as fontes de áudio do SO); sessões individuais; seleção de `pt-BR` (padrão) ou `pt-BR,en-US` antes da sessão. A alternância bilíngue só será liberada após testes e critérios de qualidade no Swift próprio.
- Assistente visível **somente ao usuário quando tecnicamente possível**, porém não prometer invisibilidade em todos os capturadores de tela; testes com compartilhamento total e de janela são obrigatórios.
- O usuário escolhe iniciar, pausar e parar a escuta. Captura e envio de screenshots exclusivamente manuais e precedidos por prévia/confirmar/cancelar.
- A aplicação inicia sem credenciais no **modo demonstração**, com diálogo simulado e sugestões simuladas, claramente identificados como tal.
- A transcrição no **MVP macOS** usa nosso **helper Swift próprio** com Apple `SpeechAnalyzer`/`SpeechTranscriber` e captura mic/system (preferencialmente `ScreenCaptureKit` para sistema), integrado ao Electron por protocolo tipado (JSONL versionado é a proposta). Não depende de binários externos de STT. STT remoto OpenAI é fallback opt-in; análise de contexto/screenshots utiliza OpenAI API. Windows é futuro.

## 3. Jornada principal
1. Usuário abre a aplicação e verifica disponibilidade das APIs Apple/modelos de idioma, compatibilidade do Mac, fontes, permissões, idiomas e credenciais de sugestões (ou ativa demonstração).
2. Vê indicação explícita **de qual dado sai do computador**: no STT Apple, o áudio é transcrito localmente; texto de contexto e screenshots aprovadas ainda podem ser enviados à OpenAI; no fallback remoto, o áudio também poderá ser enviado, após aprovação específica. Recebe orientações sobre consentimento dos participantes.
3. Escolhe microfone e, se disponível, áudio do sistema. Inicia sessão manualmente; indicador de captura ativo e botão de parada sempre acessível.
4. Recebe transcrições **finais e, se efetivamente suportado, parciais** do helper Swift próprio, com indicação de fonte (microfone ou sistema), idioma e provedor ativo (Apple Swift local/OpenAI remoto); sem identificação individual garantida.
5. A IA recebe apenas o contexto necessário e gera sugestões quando houver gatilho relevante, não a cada novo token.
6. Usuário pode clicar para expandir/copiar sugestão, descartá-la ou pedir outra alternativa; sem envio automático de respostas a terceiros.
7. Atalho de screenshot abre prévia para recortar/ocultar conteúdo e confirmar envio. Resultado relaciona imagem e contexto recente.
8. Ao pausar ou encerrar, interrompe imediatamente novos envios; limpa buffers de áudio e, por padrão, o histórico em memória ao sair.

## 4. Comportamento da IA (principal diferencial do produto)
### 4.1 Quando sugerir
- **Pergunta direta:** quando alguém pede uma resposta, opinião, número ou decisão ao usuário.
- **Risco/objeção:** quando surge objeção relevante, impedimento, contradição ou decisão com consequências práticas.
- **Esclarecimento:** quando falta um dado necessário para responder com segurança.
- **Ação/compromisso:** quando surge tarefa, responsabilidade, prazo ou decisão a confirmar.
- **Sob demanda:** atalho “sugerir agora” para análise imediata do contexto.
- **Silêncio deliberado:** sem pergunta relevante ou conteúdo novo, não exibir sugestão.

### 4.2 Formato e prioridades
- Máximo de **duas sugestões simultâneas** em cartões pequenos; cada cartão: categoria, título curto, até 2 frases ou 3 bullets curtos e ação de descartar/copiar.
- Categorias: `resposta`, `pergunta`, `alerta`, `ação`; evitar conselhos repetidos e sugestões sobre assuntos já encerrados.
- Identificar diferença entre **fato registrado na reunião** e **hipótese/inferência**; não inventar preços, datas, legislação, decisões ou números.
- Quando não houver base suficiente, apresentar pergunta de esclarecimento ou nenhum cartão; não forçar uma resposta.
- Troca de assunto ou informação mais recente invalida cartões obsoletos. Sugestões expiram conforme política configurável (default inicial: 30 s).
- Idioma da interface/sugestões configurável (default: português); transcrição mantém idioma original.

### 4.3 Contexto e disparos (defaults testáveis; sujeitos a ajuste)
- Janela móvel de falas finais recentes (~3–5 min), com resumo acumulado compacto; não enviar o histórico integral a cada requisição.
- Dar mais peso a perguntas recentes, tópico atual, objetivo da reunião (preenchido opcionalmente) e screenshot **aprovada**.
- Gatilhos por evento de fala/turno, com debounce e cooldown inicial de ~10 s entre inferências automáticas; comando manual ignora cooldown, dentro dos limites de custo.
- Não gerar várias inferências simultâneas de forma descontrolada; cancelar/descartar respostas atrasadas ou do tópico anterior.
- Sugestão nunca é enviada automaticamente para a reunião. Dados sensíveis no contexto são minimizados antes do envio, quando viável.

### 4.4 Avaliação do comportamento
Criar um conjunto de conversas sintéticas e testes com perguntas diretas, ruído, interrupções, mudança de tópico, silêncio e conversas bilíngues. Medir relevância humana, taxa de repetição, gatilhos falsos, latência, custo e comportamento na ausência de contexto. Testes automáticos validam formato/fluxo, não substituem avaliação humana da utilidade.

## 5. Requisitos funcionais
- **RF01** App desktop multiplataforma, interface flutuante e atalhos para minimizar/pausar/parar.
- **RF02** Seleção de microfone e áudio do sistema quando suportado, com estado de permissão e mensagem de falha/fallback.
- **RF03** Captura mic/sistema e transcrição ao vivo no Mac via **Swift próprio** + Apple `SpeechAnalyzer`/`SpeechTranscriber`; eventos tipados de JSONL próprio (`source`, `seq`, `locale`, timestamp, final/partial quando suportado); checagem de APIs, assets e permissões.
- **RF04** Regras de disparo e silêncio deliberado conforme §4; sugestões estruturadas, concisas e não repetitivas.
- **RF05** Seleção de idioma antes da reunião: `pt-BR` como padrão; `pt-BR,en-US` condicionado a modelos disponíveis e testes de qualidade do Swift próprio, com aviso sobre possíveis erros, além de objetivo/contexto e limites de frequência/custo.
- **RF06** Screenshot manual, prévia, opção de cancelamento e análise contextual por modelo com visão.
- **RF07** Tentar proteger o overlay contra captura via mecanismos nativos; testar resultados reais por SO/ferramenta.
- **RF08** `TranscriptionProvider` intercambiável: **`AppleNativeTranscriptionProvider` próprio é padrão no Mac**, `OpenAIRealtimeTranscriber` **opt-in** e mocks. Não usar `VoTranscriptionProvider`; Windows terá outro provider em fase futura. Sugestões e visão usam OpenAI com modelos configuráveis.
- **RF09** Configuração de chave de API de modo seguro, sem expor a chave no React renderer ou no Git.
- **RF10** Mostrar separadamente provedor STT e fluxo de dados: áudio local vs áudio remoto, contexto/imagem destinados à API, estado da conexão, custo aproximado e limite configurável por sessão.
- **RF11** Iniciar/pausar/parar impede novos envios; ao encerrar, descartar áudio bruto e limpar transcrição por padrão.
- **RF12** Modo demonstração fim a fim sem API e testes sem cobrança.
- **RF13** Tolerância a erro de rede, credenciais e rate limits, com reconexão limitada; não fingir modo real em caso de falha.
- **RF14** Sem emissão automática de mensagens em aplicações externas; ações são sugestões para o usuário.

## 6. Transcrição local e integração OpenAI — decisão do MVP
- **STT macOS (MVP):** implementar **nosso** helper `MeetingCopilotTranscriber` em Swift usando `SpeechAnalyzer`/`SpeechTranscriber` e captura autorizada de mic + sistema. `ScreenCaptureKit` é o candidato para áudio de sistema. Electron main inicia helper por `spawn`, recebe **protocolo JSONL versionado de autoria própria** e repassa eventos por IPC seguro ao renderer.
- **Verificações iniciais:** `SpeechTranscriber.isAvailable`, `supportedLocales`/`installedLocales`, modelos via `AssetInventory`, requisitos de macOS/Xcode/hardware e TCC de mic/ScreenCaptureKit. Validar no Mac real antes de declarar suporte. Um `SpeechAnalyzer` processa uma sequência de áudio por vez: desenhar fluxos por fonte e lidar com sobreposições/eco.
- **Seleção de idiomas:** padrão `pt-BR`; oferecer `pt-BR+en-US` se os dois idiomas/modelos estiverem disponíveis e **o algoritmo próprio demonstrar qualidade suficiente**. Configurar transcritores por locale e medir conflitos. Como fallback UX, permitir apenas um idioma ou troca manual. A estimativa informal de ~80% em uma POC externa **não** prova precisão no nosso código.
- **Referência externa:** resultados de uma POC exploratória permanecem somente em `docs/REFERENCIA-STT-APPLE.md`; não incorporar CLI, binário ou biblioteca externa de transcrição ao MVP.
- **Fallback remoto opt-in:** OpenAI STT, com aviso de envio de áudio, custo e necessidade de aprovação específica antes de ativar. Validar modelo efetivamente disponível na API.
- **Sugestões:** Responses API e saída estruturada, modelo configurável, qualidade/latência/custo testados no momento da implementação.
- **Screenshots:** Responses API + visão, envio somente após confirmação, com contexto mínimo.
- O aplicativo **não fala** na V1; manter captura/STT separadas da geração textual permite controlar custos e privacidade.

## 7. Requisitos não funcionais e metas provisórias
- **Latência:** medir fim da fala relevante -> cartão mostrado. Meta inicial **p95 ≤ 6 s** com boa conexão, revisável após POC; medir separadamente STT e sugestões.
- **Estabilidade:** sessão de 30 min em mock + sessão real em ambiente autorizado sem crash; reconexão e pausas testadas.
- **Segurança:** IPC allowlist, contextIsolation ligado, nodeIntegration desligado, segredo só no processo privilegiado/cofre do SO; nunca enviar segredo por IPC para renderer.
- **Custos:** transcrição Swift/Apple local não cobra transcrição por minuto **na API OpenAI** (há CPU/memória e possível download de assets); texto/imagem/fallback OpenAI são cobrados separadamente do Plus/Codex. Exibir custos estimados por modalidade, limite configurável e exigir autorização prévia.
- **Privacidade:** com STT local, áudio não precisa sair do Mac, **mas texto da conversa enviado para sugestões e imagens aprovadas ainda podem ir à OpenAI**; no fallback STT remoto, áudio também é enviado. Aviso por modalidade, consentimento aplicável, limpeza local e ausência de conteúdo sensível nos logs.
- **Acessibilidade:** contraste, leitura, atalhos configuráveis e controles legíveis.

## 8. Fora de escopo por enquanto
SaaS multiusuário, deploy remoto, integração CRM, gravação automática permanente, capturas ocultas sem consentimento, envio de mensagens a terceiros, identificação perfeita dos interlocutores, suporte mobile, IA contextual completamente offline, promessa universal de overlay oculto.

## 9. Critérios de aceite da V1
- Abertura no macOS e teste de experiência completa em mock, sem API nem chave.
- **Com Mac compatível:** **helper Swift próprio** recebe mic + áudio do sistema -> eventos versionados → Electron → contexto textual → OpenAI autorizada → cartão. Registrar qualidade/latência `pt-BR` e testes de PT+EN; sem envio de áudio à API nesse modo. Se a API Apple/idioma não estiver disponível, informar limitações e alternativas com consentimento, sem simular sucesso.
- **POC precoce** prova **nosso Swift** com `SpeechTranscriber` + mic/sistema e, depois, JSONL próprio dentro do Electron, locales e permissões; POCs externas não comprovam a nova integração. Windows será testado posteriormente.
- Testes com 6 cenários de sugestões, incluindo **silêncio deliberado** e informação insuficiente.
- Screenshot confirmado -> modelo OpenAI com visão configurável e validado -> resposta contextual; cancelado -> **zero** envios.
- Confirmação de proteção do overlay em compartilhamento de tela inteira e janela por aplicativo/OS testado; informar cobertura e limitações.
- Medir p50/p95 de latência e uso estimado da API; controle de orçamento funcional.
- Typecheck, testes, lint, build e documentação reproduzíveis; `docs/TASKS.md`/`docs/PROGRESS.md` sempre com evidências reais.

## 10. Decisões e questões abertas

As decisões confirmadas, propostas reversíveis e questões em aberto são mantidas em [DECISIONS.md](DECISIONS.md), para evitar listas divergentes neste documento.

## Referências verificadas em 2026-11-02
- Transcrição Realtime: https://developers.openai.com/api/docs/guides/realtime-transcription
- Modelos e capacidades atuais: https://platform.openai.com/docs/models (conferir nomes e preços em tempo de implementação).
- Visão: https://developers.openai.com/api/docs/guides/images-vision
- Faturamento: https://help.openai.com/pt-br/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform

- Apple SpeechAnalyzer: https://developer.apple.com/documentation/speech/speechanalyzer
- Apple SpeechTranscriber: https://developer.apple.com/documentation/speech/speechtranscriber
- Apple Speech WWDC25: https://developer.apple.com/videos/play/wwdc2025/277/
- Apple ScreenCaptureKit: https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos
- Referência exploratória e documentação da fonte: `docs/REFERENCIA-STT-APPLE.md`
