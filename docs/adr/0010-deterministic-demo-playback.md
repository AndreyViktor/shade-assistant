# ADR 0010 — Roteiro DEMO determinístico no main

Data: 2026-11-04. Tarefa: T009. Estado: aceito.

## Contexto

A sessão T008 já controla início, pausa e parada, mas não produz conteúdo. T009 exige fontes/STT/sugestões simuladas, reproduzíveis, sem rede nem credencial. O protocolo nativo e interfaces de provedores reais pertencem a T012/T021; não antecipamos esses contratos com um mock de captura.

## Decisão

`DemoPlayback` em `infrastructure/transcription/mock` reproduz três fixtures sintéticas de mic/sistema em pt-BR, com texto final e sugestão fixa correlacionados pela sequência. O primeiro turno não sugere nada. Cada transcrição tem atraso de 2 s, seguido de 1 s até a sugestão; não existe aleatoriedade, relógio de parede, áudio, SDK, acesso a segredo ou rede. O roteiro termina sem loop automático e conserva apenas o turno atual.

O main compõe o playback com `MeetingSession`, verifica `permits('demo')` antes de agendar e emitir cada etapa e cancela o timer em pausa/stop/recarga/crash/fechamento. Um contador invalida callbacks antigos. Retomar reinicia o atraso da etapa pendente; stop limpa todo o conteúdo e o cursor. A sessão permanece em andamento ao fim do roteiro até Parar, com aviso explícito na UI.

O canal existente `meeting-copilot:session` retorna um campo obrigatório `demo` além de `session`. Schema estrito limita textos a 500 caracteres, valida origem/locale/sequência e exige que a sugestão corresponda à fala atual. Main, parser do preload e renderer evoluem juntos no mesmo build interno v1; resposta do build anterior sem `demo` é rejeitada como `INVALID_RESPONSE`. Não há mistura de versões em processos externos nem protocolo Swift neste contrato. Métodos/canais expostos e política de autorização permanecem os existentes.

`useMeetingSession` separa comunicação e controles visuais, consulta snapshots a cada 500 ms somente durante reprodução e mantém no máximo uma leitura periódica pendente. Revisão de comandos e cleanup descartam respostas atrasadas. A UI apresenta texto simples explicitamente simulado; cartões, categorias, deduplicação, descarte e expiração continuam na T010.

## Alternativas e consequências

Timers no renderer duplicariam a autoridade de ciclo de vida. Eventos push exigiriam uma nova API de inscrição/remoção no preload para um roteiro pequeno. Polling do canal já validado é suficiente aqui e termina na pausa, parada, conclusão ou desmontagem; streaming real poderá exigir outro mecanismo em sua tarefa.

Testes com relógio falso verificam a sequência, silêncio, correlação, retomada, reinício, limpeza e snapshots independentes. O smoke Electron usa perfil temporário sem chave, bloqueia/conta chamadas de rede no bootstrap de teste e percorre o fluxo real main→IPC→React. Isso valida apenas a demo, sem provar reconhecimento Apple, qualidade de IA ou captura física. Não adicionamos dependências, permissões ou armazenamento.
