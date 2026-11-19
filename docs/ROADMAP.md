# Roadmap por áreas — Meeting Copilot

**Atualizado:** 2026-11-18. **Fonte de verdade:** [TASKS.md](TASKS.md).

O produto evolui de uma base local e segura para transcrição confiável, assistência avaliada, resultados estruturados, fluxos de reunião reutilizáveis e distribuição macOS endurecida. Marcos e percentuais representam escopo verificável, não estimativas de data.

**Decisões preservadas:** o MVP macOS usa captura/transcrição Swift própria com APIs Apple; áudio local permanece no Mac; texto e imagens só saem com autorização explícita; screenshot nunca é automática; Windows T036–T039 continua `DEFERRED`.

## Como o progresso é calculado

- A tarefa é atômica: `DONE` vale 100%; `TODO`, `IN_PROGRESS` e `BLOCKED` ainda valem 0% até cumprir todo o aceite. Isso evita inventar avanço parcial sem evidência.
- Progresso da funcionalidade/área = tarefas `DONE` ÷ escopo ativo (`DONE` + `IN_PROGRESS` + `TODO` + `BLOCKED`), arredondado ao inteiro mais próximo.
- `DEFERRED` permanece visível, mas é excluído do denominador porque não está comprometido na fase atual.
- Alterar o estado em [TASKS.md](TASKS.md) exige atualizar os percentuais afetados aqui. Critérios e dependências sempre prevalecem sobre a porcentagem resumida.

## Painel geral

| Área evolutiva | DONE | Ativas não concluídas | DEFERRED | Progresso ativo |
| --- | ---: | ---: | ---: | ---: |
| Fundação e arquitetura | 6 | 0 | 0 | **100%** |
| Ferramentas e documentação | 5 | 0 | 0 | **100%** |
| Transcrição e áudio | 8 | 2 | 2 | **80%** |
| Sugestões de IA e qualidade | 11 | 3 | 0 | **79%** |
| UI/UX e overlay | 8 | 2 | 4 | **80%** |
| Resultados e fluxo da reunião | 0 | 4 | 0 | **0%** |
| Segurança, privacidade e distribuição | 1 | 8 | 4 | **11%** |
| Windows futuro | 0 | 0 | 4 | **—** |
| **Total ativo** | **39** | **19** | **14** | **67%** |

## Fase atual e sequência protegida

1. **Qualidade do sinal — T056 → T057.** Remover eco/duplicação e medir o STT Apple com corpus autorizado/sintético e referência reproduzível.
2. **Qualidade da assistência — T027.** Medir latência, utilidade, irrelevância, repetição, silêncio adequado e aderência às evidências antes de ampliar o produto.
3. **Resultados estruturados — T060.** Manter tópico, decisões, ações, perguntas e riscos com fala/horário de suporte e distinção entre fato e inferência.
4. **Perfis reutilizáveis — T061.** Adaptar prioridades a descoberta, status, entrevista, negociação e revisão técnica sem transformar perfil em evidência.

As novas frentes não alteram essa ordem. Dependências foram escolhidas para que recursos de expansão não ultrapassem a validação do núcleo.

## 1. Fundação e arquitetura — 100%

| Funcionalidade | Tarefas | Estado | Progresso | Entrega/limite |
| --- | --- | --- | ---: | --- |
| Electron/React modular e fronteiras seguras | T001, T003, T004 | DONE | 100% | Main/preload/renderer/core/infrastructure separados; segredo fora do renderer. |
| DEMO e integração verificável | T009, T011 | DONE | 100% | Jornada offline determinística e smoke do Electron. |
| Protocolo Swift↔Electron | T012 | DONE | 100% | JSONL próprio, versionado, limitado e validado. |

Próxima evolução arquitetural ocorre apenas quando uma tarefa concreta exigir contrato/ADR; não criar camadas vazias.

## 2. Ferramentas, evidência e documentação — 100%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Gates locais e CI básico | T002 | DONE | 100% | Manter lint, formato, tipos, testes e build. |
| Runner com tarefas/sessões isoladas | T044 | DONE | 100% | Uma tarefa por sessão e commit local verificável. |
| Roadmap e evidências rastreáveis | T059, T062, T063 | DONE | 100% | Manter áreas e percentuais derivados do backlog em cada mudança de estado/escopo. |

## 3. Transcrição e áudio — 80%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Viabilidade Apple e captura mic/system | T005, T006 | DONE | 100% | Evidência real já registrada; hardware/rota continuam variáveis. |
| Helper Swift, provider e ciclo local | T013–T019 | DONE | 100% | Captura/transcrição local integrada ao Electron e exibida ao vivo. |
| Remover eco/duplicação | T056 | BLOCKED | 0% | Implementação/gates aprovados; falta conectar um input de áudio padrão e concluir o ensaio físico mic/system. |
| Avaliar e melhorar STT | T057 | TODO | 0% | Métrica, corpus, referência e comparação antes/depois em áudio/vídeos autorizados. |
| STT remoto e troca de idiomas | T016, T026 | DEFERRED | — | Só reativar com decisão de produto, custo e consentimento. |

## 4. Sugestões de IA e qualidade — 79%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Contexto, provider, gatilhos e scheduler | T020–T024 | DONE | 100% | Núcleo fala→contexto→OpenAI→cartões integrado. |
| Retenção, relevância e ruído de ASR | T040, T052–T055, T058 | DONE | 100% | Cartões mantidos, contexto opcional consentido e espera por fala adicional. |
| Orçamento por modalidade | T025 | TODO | 0% | Estimar/limitar custo de texto, imagem e eventual áudio remoto sem autorizar cobrança. |
| Avaliação de qualidade e uso | T027 | TODO | 0% | Protocolo de latência, utilidade, irrelevância, repetição, silêncio e evidência. |
| Feedback local dos cartões | T064 | TODO | 0% | Útil, irrelevante, incorreto ou repetido; métricas sem persistir conteúdo sensível. |

## 5. UI/UX e overlay — 80%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Painel, cartões, preferências e layout compacto | T007, T010, T041–T043, T046–T048 | DONE | 100% | Base acessível, redimensionável e utilizável durante sessão. |
| Modos de overlay | T067 | TODO | 0% | Normal, compacto, transcrição, resultados e ocultação temporária com indicador de captura. |
| Atalhos globais configuráveis | T068 | TODO | 0% | Mostrar/ocultar, pausar/retomar, parar e pedido manual com conflito e cleanup. |
| Múltiplos monitores, histórico, troca de fonte e controles separados | T045, T049–T051 | DEFERRED | — | Retomar somente após evidência de prioridade de uso. |

## 6. Resultados e fluxo da reunião — 0%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Live Meeting Brief com evidências | T060 | TODO | 0% | Tópico, decisões, ações, perguntas e riscos ligados à fala/horário. |
| Perfis de reunião | T061 | TODO | 0% | Descoberta, status, entrevista, negociação e revisão técnica; modo sem perfil preservado. |
| Ações/decisões revisáveis | T066 | TODO | 0% | Confirmar, corrigir ou descartar itens; responsável/prazo só com suporte explícito. |
| Exportação explícita | T069 | TODO | 0% | Prévia e seleção para Markdown, texto ou JSON; cancelamento não escreve nem envia. |

O histórico continua temporário por padrão. Persistência permanente ou sincronização exige tarefa e consentimento próprios.

## 7. Segurança, privacidade e distribuição — 11%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Consentimento reversível por sessão | T008 | DONE | 100% | Preservar captura/envio separados e cleanup no stop/revogação. |
| Baseline Electron + helper | T032 | TODO | 0% | Auditar TCC, IPC, CSP, sandbox, segredos, buffers, dependências e entitlements sem esperar recursos remotos adiados. |
| Prontidão e permissões | T065 | TODO | 0% | Estado real por fonte/serviço, processo responsável, rechecagem e abertura explícita dos Ajustes. |
| Regressão prolongada | T033 | TODO | 0% | Sessão mock de 30 min e sessão Mac real autorizada, com métricas e sem helper/buffer residual. |
| Pacote macOS | T034 | TODO | 0% | Incluir e assinar helper próprio; iniciar em Mac limpo compatível. |
| Diagnóstico privado | T070 | TODO | 0% | Relatório local sanitizado e pré-visualizado, sem fala, áudio, contexto ou chave. |
| Hardening do artefato | T072 | TODO | 0% | Fuses restritos, ASAR íntegro/exclusivo, DevTools/protocolo limitados, nested code assinado e notarização verificada. |
| Revisão de distribuição | T035 | TODO | 0% | Aceite macOS baseado no pacote endurecido; não afirmar screenshot/Windows adiados. |
| Atualizações seguras | T071 | TODO | 0% | Atualização assinada, adiável e compatível com reunião/TCC; hospedagem é decisão separada. |
| Screenshot e privacidade visual | T028–T031 | DEFERRED | — | Somente manual, com prévia/confirmar/cancelar e testes reais; nunca automático. |

A antiga dependência de T032 em fallback remoto e screenshot foi removida: o baseline local agora pode ser auditado antes desses recursos. T035 também não depende mais de uma matriz visual adiada; ela permanece uma fase separada e não será declarada validada.

## 8. Windows futuro — DEFERRED

| Funcionalidade | Tarefas | Estado | Progresso | Condição de retomada |
| --- | --- | --- | ---: | --- |
| Pesquisa, arquitetura, POC e distribuição Windows | T036–T039 | DEFERRED | — | Somente nova decisão explícita do usuário; não executar no ciclo macOS. |

## Ordem posterior à fase atual

Após T056→T057→T027→T060→T061, o trabalho pode seguir em trilhas dependentes:

1. **Segurança/distribuição:** T032 → T033 → T034; T065 → T070; depois T072 → T035. T071 pode vir após o pacote endurecido sem bloquear o primeiro aceite local.
2. **Qualidade orientada pelo usuário:** T064, alimentando métricas locais e a revisão dos resultados.
3. **Resultados acionáveis:** T066 → T069.
4. **Operação do overlay:** T067 → T068.

O runner ainda escolhe apenas tarefas elegíveis e uma por sessão. Esta ordem não autoriza captura, rede, custo, assinatura, notarização, deploy ou atualização automática.

## Guardrails de produto

- Não gravar áudio bruto nem persistir transcrição por padrão.
- Não adicionar câmera, Bluetooth, Accessibility ou Apple Events sem funcionalidade e aceite específicos.
- Não enviar feedback, diagnóstico, screenshot ou exportação automaticamente.
- Não prometer diarização, precisão perfeita, overlay universalmente invisível ou ausência total de custo.
- Não usar integrações/telemetria para ultrapassar consentimento, fronteiras IPC ou segredo no main/cofre do SO.
- Usar [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md) para gates, [WORKFLOW.md](WORKFLOW.md) para sessão/commit e [PROGRESS.md](PROGRESS.md) para o handoff curto.

Referências técnicas: [Apple SpeechAnalyzer](https://developer.apple.com/documentation/speech/speechanalyzer), [SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber), [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos) e [referência exploratória](REFERENCIA-STT-APPLE.md).
