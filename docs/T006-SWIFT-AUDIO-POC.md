# T006 — POC Swift própria: preparação e teste manual

**Estado: BLOCKED aguardando conclusão da validação.** A implementação está compilada e os assets pt-BR foram preparados. O usuário relatou transcrição real de mic/system, uso simultâneo e atalhos funcionais; o teste encerrou automaticamente após cerca de dois minutos com `STOPPED_CAPTURE_OFF`, e o usuário confirmou que o indicador do microfone apagou. Falta confirmar o comando manual `q`; PT+EN simultâneo é rejeitado e ainda não foi avaliado quanto à qualidade. Evidências em [PROGRESS.md](PROGRESS.md). Não abrir o Electron para este teste: a POC é um programa independente no Terminal.

## Resultado independente — 2026-11-04

- Mac arm64, macOS 26.6.2; Xcode 26.6 / SDK 26.5 / Swift 6.3.3. Mesmo ambiente de T005; target da POC/bundle: macOS 26+, diagnóstico anterior preservado.
- Bundle: `native/macos/.build/MeetingCopilotAudioPOC.app`, assinatura ad hoc local verificada com `codesign --verify --strict`; plist validado. Isso não comprova distribuição, notarização ou atribuição de TCC.
- `--prepare-assets --locale pt-BR`, por escalada aprovada e autorização prévia do usuário: `supported` → `installed` → `ASSETS_PREPARED_NO_CAPTURE_pt-BR`. A segunda execução começou/terminou `installed` e preparou novamente. A Apple retornou request de instalação nas duas execuções; não foi medido tráfego/volume, portanto não afirmamos se houve download ou reaproveitamento local. [Evidência](evidence/T006-assets-2026-11-04.json).
- Nenhum comando de captura real ou pedido TCC executado. En-US não preparado/testado nesta sessão; PT+EN simultâneo rejeitado. Sem OpenAI, conteúdo de reunião ou arquivos de áudio.
- Gates e contagens finais estão no [handoff](PROGRESS.md). Testes sintéticos e fakes não são evidência de captura Apple.

## 1. Preparar o Terminal

**Agora é necessária a participação do usuário.** Antes de executar captura, feche reuniões, players, notificações sonoras e qualquer fonte de fala real. Para teste `system`/`both`, a POC recebe o áudio dos aplicativos do sistema no display selecionado, não apenas o áudio de um app específico. Use somente as frases sintéticas abaixo. Prefira fones para evitar que o microfone recapture a saída do sistema.

Abra **Terminal.app** e execute:

```bash
cd /Users/5by5andrey-viktor/side-prj/meeting-copilot/meeting-copilot-codex
sh scripts/build-audio-poc.sh
python3 scripts/check-audio-poc.py
./native/macos/.build/MeetingCopilotAudioPOC.app/Contents/MacOS/MeetingCopilotAudioPOC --prepare-assets --locale pt-BR
```

O build não abre captura. Os checks usam pipes sem terminal e verificam a recusa da captura nesse contexto. A preparação pode acessar servidores Apple e demorar até dez minutos; não solicita acesso ao microfone/tela. Espere `ASSETS_PREPARED_NO_CAPTURE_pt-BR`. Se surgir erro, compartilhe somente o código `POC_*` e pare antes de capturar. Não use `sudo`, reset TCC ou remoção de quarentena. Se macOS bloquear a execução, informe a mensagem sem contornar a proteção.

O bundle já está construído no workspace desta sessão, mas os comandos acima permitem reproduzi-lo após checkout. O primeiro comando de captura abaixo é o momento em que você autoriza o ensaio e pode receber prompts macOS. Execute diretamente no Terminal; não use `open`, duplo clique, pipe, `tee` ou redirecionamento. A POC precisa de stdin/stdout interativos.

## 2. Testar microfone primeiro

```bash
./native/macos/.build/MeetingCopilotAudioPOC.app/Contents/MacOS/MeetingCopilotAudioPOC --capture --source mic --locale pt-BR --show-text
```

Você verá ajuda, `MANUAL_CAPTURE_REQUESTED_mic_pt-BR` e a verificação de permissão. O macOS pode pedir acesso ao microfone, atribuído à **Meeting Copilot Audio POC** ou ao **Terminal**, conforme a identidade responsável determinada pelo SO. Conceda somente se quiser realizar este teste. Permissão negada deve produzir `POC_MICROPHONE_DENIED` e saída sem captura. Se precisar alterar uma decisão anterior, faça isso manualmente em Ajustes do Sistema → Privacidade e Segurança → Microfone; depois execute novamente. A POC não altera essas permissões.

**Só comece a falar quando aparecer `CAPTURE_ACTIVE_SPEAK_SYNTHETIC_PHRASES_NOW`.** Fale pausadamente, deixando cerca de cinco segundos de silêncio entre as frases:

1. “Este é um teste local de microfone em português.”
2. “O projeto fictício tem três etapas e termina na sexta-feira.”
3. “Qual é o próximo passo do nosso teste?”

Devem surgir linhas com `event: transcription`, `source: mic`, `locale: pt-BR`, `isFinal`, `segment`, tempo do áudio e, por causa de `--show-text`, texto. Parciais são os resultados voláteis reais da Apple; podem mudar e não devem ser somados aos finais como frases distintas. Avalie o texto localmente. Se nada chegar em 15–20 s após falar, pare e relate contagens/código; não conclua que STT funcionou só porque houve `CAPTURE_ACTIVE`.

Para testar pausa:

- Digite **`p` + Enter**; aguarde `PAUSED_CAPTURE_OFF` e o indicador do microfone apagar.
- Diga “Esta frase não deve aparecer durante a pausa.” Não deve surgir novo evento de transcrição.
- Digite **`r` + Enter**; espere `CAPTURE_ACTIVE...` e diga “O teste foi retomado.” O `segment` deve aumentar.
- Espere alguns segundos para receber um final; digite **`q` + Enter**. Deve aparecer `STOPPED_CAPTURE_OFF`, contagens `SUMMARY_*` e retornar ao prompt, com indicador apagado.

**Ctrl-C também interrompe** e tenta limpar recursos. Se o serviço Apple travar, após oito segundos pode aparecer `POC_FORCED_INTERRUPT`; isso é falha de limpeza a reportar, não sucesso. Há parada automática após 120 s desde o primeiro início (pausas incluídas); o watchdog total é 180 s desde o lançamento. `POC_WATCHDOG_TIMEOUT` também indica falha. O encerramento elimina o processo e seus handles de captura; confirme o indicador do SO. Pausa/parada descartam hipóteses ainda pendentes: aguarde finais antes de parar quando quiser avaliar qualidade.

`--show-text` é opt-in e mostra frases no scrollback do Terminal; não copie esse conteúdo para logs nem para o Git. Para um teste só com metadados, remova essa opção. Não há arquivo de transcrição nem áudio criado pelo programa.

## 3. Testar áudio do sistema

Com os outros apps silenciosos e preferencialmente com fones, execute no primeiro Terminal:

```bash
./native/macos/.build/MeetingCopilotAudioPOC.app/Contents/MacOS/MeetingCopilotAudioPOC --capture --source system --locale pt-BR --show-text
```

Pode aparecer um pedido macOS para **Gravação de Tela e Áudio do Sistema** / acesso a áudio do sistema; o rótulo depende da versão do macOS e pode citar o Terminal. A POC registra somente saída de áudio do ScreenCaptureKit, não recebe frames de tela. Conceder/rejeitar é sua ação manual. Se o SO exigir encerrar/reabrir o Terminal, faça isso e repita o `cd` e o comando. Falha/permissão negada pode aparecer como `POC_CAPTURE_FAILED` ou `POC_SYSTEM_ACCESS_OR_DISPLAY_UNAVAILABLE`; não há fallback remoto.

Espere `CAPTURE_ACTIVE...`. Em um **segundo Terminal**, gere uma fala de teste com a síntese de voz nativa Apple (não é ferramenta de transcrição e não salva áudio):

```bash
/usr/bin/say -v 'Eddy (Português (Brasil))' 'Este é um teste do áudio do sistema. O projeto fictício tem três etapas. Qual é o próximo passo?'
```

Essa voz constava na lista local consultada nesta sessão; a reprodução não foi executada pelo agente. Se ela não estiver disponível, consulte `/usr/bin/say -v '?'` e selecione manualmente uma voz `pt_BR` existente, ou reproduza um material sintético local conhecido. Não use reunião/vídeo com dados reais. A síntese precisa tocar depois de `CAPTURE_ACTIVE`.

No primeiro Terminal, confira `source: system`, pt-BR e texto. Repita pausa/retomada com `p`/`r`, reproduzindo a frase durante a pausa e novamente após retomar. Encerre com `q` ou Ctrl-C. O modo só sistema não deve solicitar microfone. Registre ausência de texto, duplicação, atraso e erros sem copiar falas.

## 4. Testar fontes simultâneas e limites de idioma

Somente após testar as fontes separadamente:

```bash
./native/macos/.build/MeetingCopilotAudioPOC.app/Contents/MacOS/MeetingCopilotAudioPOC --capture --source both --locale pt-BR --show-text
```

Após `CAPTURE_ACTIVE`, reproduza a mesma frase sintética pelo segundo Terminal enquanto fala outra frase de teste no microfone. Verifique que há eventos `mic` e `system`, sem confundir fonte com pessoa. Use fones; com alto-falantes, duplicação acústica é esperada e não há cancelamento de eco nesta POC. Repita pausa/retomada/parada e confirme que ambas fontes param. Falha de uma fonte deve encerrar o ensaio inteiro e limpar ambas.

Os tempos do áudio são relativos **a cada fonte e segmento**; não representam relógio global ou latência ponta a ponta. `timestamp` é o horário de entrega. `AUDIO_SUMMARY_*` conta buffers/segundos processados, não frases reconhecidas. Qualidade/atraso só podem ser relatados após ouvir e comparar localmente; não há WER ou p95 medidos nesta sessão.

Opcional, somente depois do pt-BR: repetir preparação com `--locale en-US` e captura em **uma execução separada**, se suportado. En-US ainda não foi validado aqui. `pt-BR,en-US` é recusado: esta POC não implementa detecção bilíngue, seleção entre hipóteses ou garantia de qualidade mista. A limitação está registrada para avaliação futura dentro de T006; não alegar percentual de precisão.

## 5. Compartilhar resultado sem conteúdo sensível

Copie/preencha apenas este resumo, sem texto reconhecido, screenshots do Terminal, áudio, nomes de dispositivos/contas ou logs completos:

```text
T006 / macOS: [versão] / bundle reconstruído: sim ou não
Assets pt-BR: ASSETS_AFTER_... / ASSETS_PREPARED_NO_CAPTURE_pt-BR ou código POC_...
Permissões: mic autorizado/negado; sistema autorizado/negado; prompt atribuído a POC/Terminal
mic: finais N, parciais N; buffers N; texto parece correto/parcial/incorreto/ausente
system: finais N, parciais N; buffers N; texto parece correto/parcial/incorreto/ausente
both: eventos das duas fontes sim/não; duplicação sim/não; fones sim/não
Pausa: indicadores apagaram sim/não; eventos durante pausa sim/não
Retomada: segment aumentou sim/não; nova fala reconhecida sim/não
Parada: STOPPED_CAPTURE_OFF sim/não; indicador apagou sim/não; prompt retornou sim/não
Atraso aproximado após terminar frase: [segundos, estimativa humana]
Erros: [somente códigos POC_* ou nenhum]
```

Se negar uma permissão, isso é um teste de falha válido, mas não prova transcrição daquela fonte. T006 permanece BLOCKED até registrar evidência real das duas fontes e do lifecycle, revisar problemas observados e executar os gates após eventuais correções. Não avançar tarefa nem usar o runner para ignorar o bloqueio.
