# Roadmap por áreas — Meeting Copilot

**Atualizado:** 2026-11-24. **Fonte de verdade:** [TASKS.md](TASKS.md).

O produto evolui de uma base local e segura para transcrição confiável, assistência avaliada, resultados estruturados, fluxos de reunião reutilizáveis e distribuição macOS endurecida. Marcos e percentuais representam escopo verificável, não estimativas de data.

**Decisões preservadas:** o MVP macOS usa captura/transcrição Swift própria com APIs Apple; áudio local permanece no Mac; texto e imagens só saem com autorização explícita; screenshot nunca é automática; Windows T036–T039 continua `DEFERRED`.

## Como o progresso é calculado

- A tarefa é atômica: `DONE` vale 100%; `TODO`, `IN_PROGRESS` e `BLOCKED` ainda valem 0% até cumprir todo o aceite. Isso evita inventar avanço parcial sem evidência.
- **Escopo ativo** inclui toda tarefa comprometida na fase atual: `DONE`, `TODO`, `IN_PROGRESS` ou `BLOCKED`. É mais amplo que o estado `IN_PROGRESS`, que identifica somente uma tarefa em execução agora.
- **Ativas não concluídas** soma `TODO` + `IN_PROGRESS` + `BLOCKED`. As tarefas `DONE` aparecem separadamente, mas continuam no denominador do progresso ativo.
- Progresso da funcionalidade/área = tarefas `DONE` ÷ escopo ativo, arredondado ao inteiro mais próximo.
- `DEFERRED` permanece visível, mas é excluído do denominador porque não está comprometido na fase atual.
- Alterar o estado em [TASKS.md](TASKS.md) exige atualizar os percentuais afetados aqui. Critérios e dependências sempre prevalecem sobre a porcentagem resumida.

## Painel geral

| Área evolutiva | Progresso ativo | DONE | Ativas não concluídas | DEFERRED |
| --- | ---: | ---: | ---: | ---: |
| Fundação e arquitetura | **100%** | 6 | 0 | 0 |
| Ferramentas e documentação | **100%** | 6 | 0 | 0 |
| Transcrição e áudio | **100%** | 10 | 0 | 2 |
| Sugestões de IA e qualidade | **87%** | 13 | 2 | 0 |
| UI/UX e overlay | **100%** | 13 | 0 | 4 |
| Resultados e fluxo da reunião | **60%** | 3 | 2 | 0 |
| Segurança, privacidade e distribuição | **33%** | 3 | 6 | 4 |
| Windows futuro | **—** | 0 | 0 | 4 |
| **Total ativo** | **84%** | **54** | **10** | **14** |

## Fase atual e sequência protegida

A sequência T058 → T056 → T057 → T027 → T060 → T061 foi concluída. Também estão concluídas a reformulação de Preferências, a escolha de foco por sessão, a simplificação do overlay e os atalhos globais (T074–T077 e T068). A T065 foi aceita para uso local. Os ensaios de prontidão em Mac limpo e após mudança de assinatura seguem em T034. Os critérios e limites de cada entrega estão em [TASKS.md](TASKS.md).

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
| Roadmap e evidências rastreáveis | T059, T062, T063, T073 | DONE | 100% | Manter áreas, definições e percentuais derivados do backlog em cada mudança de estado/escopo. |

## 3. Transcrição e áudio — 100%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Viabilidade Apple e captura mic/system | T005, T006 | DONE | 100% | Evidência real já registrada; hardware/rota continuam variáveis. |
| Helper Swift, provider e ciclo local | T013–T015, T017–T019 | DONE | 100% | Captura/transcrição local integrada ao Electron e exibida ao vivo. |
| Remover eco/duplicação | T056 | DONE | 100% | Supressão textual validada no cenário registrado, sem alegar cancelamento acústico universal. |
| Avaliar e melhorar STT | T057 | DONE | 100% | Avaliação offline e ensaio físico registrados, com limites do corpus. |
| STT remoto e troca de idiomas | T016, T026 | DEFERRED | — | Só reativar com decisão de produto, custo e consentimento. |

## 4. Sugestões de IA e qualidade — 87%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Contexto, provider, gatilhos e scheduler | T020–T024 | DONE | 100% | Núcleo fala→contexto→OpenAI→cartões integrado. |
| Retenção, contexto opcional e ruído de ASR | T040, T052–T055 | DONE | 100% | Cartões mantidos, contexto opcional consentido e proteção contra ruído de ASR. |
| Prontidão de contexto e agendamento | T058 | DONE | 100% | Gatilhos locais e debounce compartilhado, com pedido manual preservado. |
| Orçamento por modalidade | T025 | TODO | 0% | Estimar e limitar custo de texto, imagem e áudio remoto. A execução depende da T016, que está adiada. |
| Avaliação de qualidade e uso | T027 | DONE | 100% | Protocolo offline e comparação real limitada registrados. |
| Feedback local dos cartões | T064 | DONE | 100% | Classificações e métricas locais sem persistir conteúdo sensível. |
| Verificação factual de vídeos | T078 | BLOCKED | 0% | Implementação offline e smoke concluídos; ensaio real com busca e citações aguarda autorização para custo e credencial. |

## 5. UI/UX e overlay — 100%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Painel, cartões, preferências e layout compacto | T007, T010, T041–T043, T046–T048 | DONE | 100% | Base acessível, redimensionável e utilizável durante sessão. |
| Visualizações do overlay | T067, T077 | DONE | 100% | Completa, somente transcrição e somente assistência, com seletor acessível e layout responsivo. [Evidências da T077](evidence/tasks/T077.md). |
| Atalhos globais configuráveis | T068 | DONE | 100% | Mostrar ou ocultar a janela, pausar ou retomar, parar e pedir ajuda. Configuração com confirmação, detecção de conflitos e suspensão durante edição no painel. [Evidências e limites](evidence/tasks/T068.md). |
| Design e reformulação de preferências | T074, T076 | DONE | 100% | Áreas com resumo dos valores salvos, confirmação de descarte e prontidão local preservada. [Evidências da T076](evidence/tasks/T076.md). |
| Múltiplos monitores, histórico, troca de fonte e controles separados | T045, T049–T051 | DEFERRED | — | Retomar somente após evidência de prioridade de uso. |

## 6. Resultados e fluxo da reunião — 60%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Live Meeting Brief com evidências | T060 | DONE | 100% | Tópico, decisões, ações, perguntas e riscos ligados à fala/horário. |
| Perfis de reunião | T061 | DONE | 100% | Descoberta, status, entrevista, negociação e revisão técnica; modo sem perfil preservado. |
| Escolha do assistente por sessão | T075 | DONE | 100% | Cada sessão começa em **Sem perfil**. O usuário escolhe o foco ao habilitar sugestões, com consentimento separado. [Evidências da T075](evidence/tasks/T075.md). |
| Ações/decisões revisáveis | T066 | TODO | 0% | Confirmar, corrigir ou descartar itens; responsável/prazo só com suporte explícito. |
| Exportação explícita | T069 | TODO | 0% | Prévia e seleção para Markdown, texto ou JSON; cancelamento não escreve nem envia. |

O histórico continua temporário por padrão. Persistência permanente ou sincronização exige tarefa e consentimento próprios.

## 7. Segurança, privacidade e distribuição — 33%

| Funcionalidade | Tarefas | Estado | Progresso | Próximo resultado |
| --- | --- | --- | ---: | --- |
| Consentimento reversível por sessão | T008 | DONE | 100% | Preservar captura/envio separados e cleanup no stop/revogação. |
| Baseline Electron + helper | T032 | DONE | 100% | Auditoria e evidências do baseline registradas; distribuição endurecida segue T072. |
| Prontidão e permissões | T065 | DONE | 100% | Aceita para uso local; ensaios em Mac limpo e após mudança de assinatura permanecem em T034. |
| Regressão prolongada | T033 | TODO | 0% | Sessão mock de 30 min e sessão Mac real autorizada, com métricas e sem helper/buffer residual. |
| Pacote macOS | T034 | TODO | 0% | Incluir e assinar helper próprio; validar Mac limpo e mudança de identidade/TCC antes de entregar o pacote. |
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

## Próximas tarefas

T033, T066 e T070 estão elegíveis. Sem uma seleção explícita, o runner escolhe T033 pela ordem do backlog.

1. **T033** valida sessões prolongadas e libera o empacotamento macOS em T034.
2. **T066** permite revisar os resultados ligados às falas e libera a exportação com prévia em T069.
3. **T070** entrega o diagnóstico local sanitizado. T034 e T070 liberam o hardening em T072. Depois do hardening, podem avançar a revisão da distribuição (T035) e as atualizações assinadas (T071).

O runner executa tarefas elegíveis em sessões separadas. Captura, envio, custos e distribuição continuam sujeitos às autorizações do projeto.

## Guardrails de produto

- Não gravar áudio bruto nem persistir transcrição por padrão.
- Não adicionar câmera, Bluetooth, Accessibility ou Apple Events sem funcionalidade e aceite específicos.
- Não enviar feedback, diagnóstico, screenshot ou exportação automaticamente.
- Não prometer diarização, precisão perfeita, overlay universalmente invisível ou ausência total de custo.
- Não usar integrações/telemetria para ultrapassar consentimento, fronteiras IPC ou segredo no main/cofre do SO.
- Usar [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md) para gates, [WORKFLOW.md](WORKFLOW.md) para sessão/commit e [PROGRESS.md](PROGRESS.md) para o handoff curto.

Referências técnicas: [Apple SpeechAnalyzer](https://developer.apple.com/documentation/speech/speechanalyzer), [SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber), [ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-in-macos) e [referência exploratória](REFERENCIA-STT-APPLE.md).
