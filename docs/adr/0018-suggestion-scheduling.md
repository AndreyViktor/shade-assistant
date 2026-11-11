# ADR 0018 — Agendamento e invalidação de sugestões

Data: 2026-11-11. Escopo: T023.

## Contexto

T022 classifica eventos sem estado; T021 produz conteúdo sem publicá-lo. O store existente controla dois cartões e dedup/TTL. Falta uma autoridade local para limitar inferências e impedir que uma resposta antiga reapareça após novas informações ou término de sessão.

## Decisão

- `SuggestionScheduler` no core compõe provider e store, sem Electron, rede, credenciais, persistência ou dependências novas. API: `start(signal)`, `submit(context, revision, trigger)`, `invalidate()`, `stop()`, `snapshot()` e `dismiss(id)`. Contexto é validado/limitado a montante e copiado ao enfileirar. Idioma é configurável no construtor.
- O host fornece revisão inteira monotônica por nova fala final/informação contextual aceita. Revisões automáticas iguais/antigas são ignoradas sem adiar debounce; manual pode reutilizar a revisão atual. Parciais e silêncio não geram revisão. T024 deve filtrar eventos/sessão antes de submeter contexto, conectar o sinal de pausa/stop/revogação e consultar snapshots para atualizar o overlay. Revisões são locais ao scheduler, não alteram IPC/JSONL.
- Debounce automático trailing de 500 ms e cooldown de 10 s desde o último início de chamada (inclusive manual/falha). Há somente um contexto pendente, substituído pelo mais recente. Manual remove a espera de debounce/cooldown, mas aguarda a chamada em voo terminar. A função obrigatória de autorização é consultada na submissão, imediatamente antes do provider e antes da publicação; deve refletir sessão, consentimento e orçamento. Ela não concede consentimento nem implementa contabilização monetária.
- Cada submissão nova aceita invalida o trabalho anterior e os cartões visíveis. Isso inclui trigger `none` com informação nova e solicitação manual na mesma revisão. A regra é conservadora: não tenta detectar semanticamente mudança de assunto. `invalidate()` também permite encerramento explícito de tópico. A supressão de conteúdo repetido sobrevive à invalidação até o TTL original.
- Cancelamento usa `AbortController` por chamada. Mesmo se o provider ignorar abort, seu resultado é descartado. A vaga de execução só é liberada quando a promise termina, inclusive ao reiniciar sessão: nunca disparar chamadas sobrepostas para compensar um adapter que não coopera. Se ele nunca terminar, novas sugestões aguardam; os providers de T021 têm cancelamento/timeout próprios. Essa escolha privilegia ausência de concorrência descontrolada sobre recuperação de adapters defeituosos.
- Respostas só são aceitas antes de 15 s desde o dispatch (configurável); no limite, abort e descarte. O relógio também é conferido após o `await`, evitando aceitar resposta antiga quando o callback de timer atrasar. Falhas tipadas, exceções e lotes vazios produzem silêncio, sem retries nem logs de payload. Nova ação/evento pode tentar novamente.
- `SuggestionStore.invalidate()` esconde cartões sem apagar dedup. TTL de cartões permanece 30 s desde publicação, máximo dois, normalização NFKC/caixa/espaços e histórico limitado a 100 entradas. Descarte/invalidação/duplicata não renovam validade. Expiração é aplicada nas leituras, mesmo sem fala; não existe timer de UI no core. `stop()`/abort limpa cartões, supressão, pendência e cooldown; `start()` cria novo escopo. IDs continuam crescentes durante a vida da instância para evitar descarte antigo afetar a sessão seguinte; o host deve reutilizar essa instância durante seu lifecycle.
- Temporizadores de debounce e prazo são removidos na invalidação/parada/conclusão. Políticas rejeitam durações inválidas ou acima do limite de timers JS; debounce/cooldown aceitam zero para configuração/teste. Relógio usa `Date.now`, consistente com o store existente; ajustes de relógio do SO afetam as janelas.

## Alternativas e consequências

Liberar a vaga imediatamente no abort permitiria chamadas simultâneas quando o provider não cooperasse. Fila de todos os gatilhos produziria sugestões antigas e retenção desnecessária. Detecção semântica/dedup por similaridade exigiria outra política e avaliação humana; não faz parte desta fatia.

A invalidação conservadora pode ocultar cartões ainda úteis em uma conversa contínua. Defaults de 500 ms/10 s/15 s/30 s são testáveis e reversíveis, sem afirmação de utilidade ou latência real. O modo DEMO existente e o fluxo Apple Local não foram conectados ao scheduler. Integração real, consentimento/custo efetivos e atualização do overlay ficam nas tarefas correspondentes. Evidências offline em [TEST-T023.md](../TEST-T023.md).
