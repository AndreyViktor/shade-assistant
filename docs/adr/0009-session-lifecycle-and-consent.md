# ADR 0009 — Sessão em memória e autorização por modalidade

Data: 2026-11-04. Tarefa: T008. Estado: aceito.

## Contexto

O painel precisa de início manual, pausa/parada e explicação do fluxo de dados antes de receber mocks (T009) ou adapters reais (T014/T016). Preferências persistidas e presença de chave não são consentimento. O renderer não pode ser autoridade de captura/envio.

## Decisão

`MeetingSession` no core é a autoridade de estado em memória, composta no main por janela. O contrato IPC v1 ganha canal fechado `meeting-copilot:session`, com `read/start/pause/resume/stop`, schemas estritos e autorização pelo frame/URL/janela existente. A API preload acrescenta somente `session(request)`; não aceita canais, callbacks, conteúdo de reunião ou segredos. O contrato antigo de status continua descrevendo as capacidades efetivamente disponíveis: DEMO, captura inativa, IA desligada e nenhum envio.

Início real requer consentimento de captura; texto contextual e áudio remoto têm flags separadas. Áudio remoto só é permitido no modo OpenAI STT com opt-in. DEMO elimina todas essas autorizações. Pausa bloqueia novo trabalho e aborta a geração atual; retomada usa uma geração nova. Stop é idempotente, limpa consentimentos e exige novo início. Nenhum consentimento é persistido. Screenshot não tem permissão geral: deverá ganhar confirmação por imagem em T028.

`run(kind, work)` verifica permissão imediatamente antes de iniciar trabalho, entrega AbortSignal e descarta respostas/falhas de gerações canceladas. Adapters futuros precisam respeitar esse sinal, verificar novamente a permissão ao drenar filas e integrar limpeza dos próprios buffers/processos. Cancelar não recupera dados já enviados. A implementação não declara cancelamento de rede ou captura física comprovados sem esses adapters.

Nesta entrega, o main aceita **somente DEMO**, mesmo com preferências reais ou chave armazenada. A UI oferece controles de sessão e avisos local/remoto; não oferece autorização real inoperante. Reload, crash do renderer e fechamento encerram a sessão. Não há novas permissões Electron, rede, provider, transcrição ou implementação da T009.

## Alternativas e consequências

Estado apenas no React permitiria divergência e autorizações perdidas na recarga; foi rejeitado. Persistir consentimento poderia reativar envio sem novo início; foi rejeitado. Não se introduziu biblioteca de estado, SDK ou protocolo Swift.

Testes de core usam operações sintéticas para provar bloqueio, cancelamento e descarte tardio. Smoke Electron comprova comandos através do IPC e DEMO sem HTTP(S) observado no renderer. Isso não substitui ensaio físico Swift→Electron nem chamadas OpenAI autorizadas. A integração real e seus gates continuam nas tarefas correspondentes.
