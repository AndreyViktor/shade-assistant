# T048 — Revisão integrada do layout

Data: 2026-11-13. Estado: **DONE**. Retomada sobre `a6257fc`, branch `main`, árvore inicialmente limpa; T047 DONE. Somente T048 executada.

## Plano e autorização

Plano registrado em PROGRESS.md e T048 marcada IN_PROGRESS antes de alterar testes: executar smoke offline fora do sandbox pela revisão automática; complementar acesso a Preferências em sessão ativa e alcance do conteúdo/controles em zoom; inspecionar imagens; corrigir regressões reproduzidas; executar verify, smoke completo e diff check; concluir e fazer commit local somente com aceite comprovado. Nenhuma recusa seria contornada.

O usuário autorizou explicitamente Electron gráfico fora do sandbox com fixtures sintéticas e rede bloqueada. Os pedidos `require_escalated` passaram pela revisão automática normal e foram aprovados. Ambiente: macOS 26.6.2 (25G83), Node 26, Electron 45.2.1, Playwright 1.64.1. Não houve alteração de permissões do SO ou das fronteiras Electron.

## Bloqueio anterior, preservado como histórico

A sessão anterior, sobre `9d34f6a`, executou `npm run test:smoke` dentro do sandbox: build aprovado e 24 falhas `Process failed to launch!`, com `kill EPERM` e SIGABRT antes da UI. Não houve execução fora do sandbox nem recusa da revisão naquela sessão; verify e inspeção visual ficaram pendentes. O commit `a6257fc` registrou esse bloqueio. Na retomada autorizada, o mesmo smoke fora do sandbox passou **24/24**; isso resolve o impedimento de validação, sem atribuir uma causa interna ao abort anterior.

## Cobertura integrada

A suíte existente cobre estado vazio, captura e sugestões sintéticas, pausa/retomada/parada, retenção/descarte dos cartões, erros de transcrição e autenticação, diagnóstico seguro, DEMO, navegação, consentimento, migração/persistência e isolamento. Os dois cenários de `tests/e2e/integrated-layout.spec.ts` acrescentam:

- Painel ativo com oito falas longas e dois cartões, nas janelas 960×720 e 640×480. Preferências deve estar totalmente na viewport **antes** de clique/foco que possa rolar a página; o clique real, retorno e snapshot comprovam acesso sem alterar a sessão.
- Janela 640×480 com zoom nativo 200% (viewport CSS 320×224): início/fim das falas, quebra de texto sem espaços, Tab pelos cartões, descarte acessível, revogação, Preferências, retorno por Escape e todos os seletores. Privacidade e Diagnóstico alcançáveis por rolagem; DEMO bloqueada durante sessão local; snapshot inalterado ao navegar.
- Pausa, retorno de Preferências sem mudança de estado, retomada e parada em zoom; cartões e falas limpos segundo a política existente.
- Consentimento sem credencial: limite, aviso de envio/custo, ação local e cancelamento alcançáveis em zoom. Sugestões desabilitadas sem chave, ciclo de Tab dentro do diálogo, Escape devolve foco e nenhuma captura/rede ocorre.

Os perfis e helpers são temporários. `createTestApp` remove a chave do ambiente, substitui o caminho do app (sem `.env` pessoal), usa somente chave sintética quando necessário, bloqueia transportes de rede antes de carregar o produto e substitui o helper Swift por replay JSONL. Os testes sem helper usam bloqueio de captura; os cenários nativos usam exclusivamente o executável sintético. Nenhum arquivo de código do produto ou Swift foi alterado.

## Ajustes durante a revisão

As primeiras execuções dos testes novos falharam durante sua construção: exigir um parágrafo maior que a viewport inteiramente visível; arredondamento subpixel em zoom; ordem de Tab sem o disclosure de retenção; seletor exato de label que incluía texto das opções; e disputa entre Home/End animado e o Tab seguinte. Os testes foram corrigidos mantendo as verificações funcionais: extremos do texto, geometria dentro dos ancestrais que recortam, hit-test, foco, estado e bloqueios offline. A rolagem deve estabilizar antes da próxima ação; no macOS, Home também move o documento externo, que é reposicionado para inspecionar a coluna. Não se atribui essa sequência sintética a uma regressão do produto.

O recorte em imagens Playwright com zoom nativo foi reproduzido tanto em `fullPage` quanto na viewport. As novas imagens vêm de `BrowserWindow.webContents.capturePage()` **somente da janela sintética**, sem captura da tela do usuário. A captura aguarda dois frames de renderização após a rolagem para evitar registrar a imagem anterior. Essa captura preserva os pixels efetivamente renderizados; imagens recortadas das tentativas exploratórias não servem de aceite.

Lint também apontou o handle Electron sem tipagem e o retorno não tipado de `DOMRect.toJSON()` no teste. O handle passou a ter tipo explícito e o diagnóstico usa campos numéricos, sem supressão de regras. O verify posterior passou. Não foi necessária correção de produto nos cenários revisados.

## Gates e evidências finais

Comandos executados com `PATH=/opt/homebrew/opt/node@26/bin:$PATH`:

| Gate                                                                                                                         | Resultado                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:smoke -- --max-failures=1` (baseline fora do sandbox)                                                          | 24/24 aprovados                                                                                                                 |
| `npm run test:smoke` (com os novos cenários)                                                                                 | **26/26 aprovados**, 2,5 min, saída 0                                                                                           |
| `node node_modules/@playwright/test/cli.js test tests/e2e/integrated-layout.spec.ts --output=/private/tmp/t048-native-final` | **2/2 aprovados**, após acrescentar espera de pintura à captura; imagens finais regeneradas                                     |
| `npm run verify`                                                                                                             | 866 TS aprovados, 18 skipped; 19 runner; lint, formatação, tipos e build aprovados novamente após o ajuste de pintura (saída 0) |
| `git diff --check`                                                                                                           | Aprovado no fechamento                                                                                                          |

Logs locais: `/private/tmp/t048-smoke-resume.log`, `/private/tmp/t048-smoke-final.log`, `/private/tmp/t048-images-final.log`, `/private/tmp/t048-verify-complete.log`. As execuções exploratórias estão em `/private/tmp/t048-integrated*.log`; os resultados finais acima substituem essas tentativas, cujas falhas e correções estão descritas anteriormente.

### Inspeção visual registrada

As 25 imagens preservadas em [evidence/T048](evidence/T048/) foram inspecionadas. Imagens de zoom são capturas nativas da viewport após a rolagem; cada uma mostra uma parte alcançável, sem montagem nem edição de pixels.

| Fluxo                        | Observação e imagens                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vazio e sessão ativa         | Controles legíveis, colunas sem sobreposição; Preferências visível mesmo com falas/cartões longos. [Vazio 640](evidence/T048/idle-640.png), [ativo 960](evidence/T048/active-960.png), [ativo 640](evidence/T048/active-640.png).                                                                                                                                                                                  |
| Preferências em sessão ativa | Retorno explícito, explicação da próxima sessão e estado preservado. [Tela completa](evidence/T048/settings-active.png), [acesso por Tab em zoom](evidence/T048/zoom-preferences-access.png), [topo](evidence/T048/zoom-settings-top.png), [modelo](evidence/T048/zoom-settings-model.png), [privacidade](evidence/T048/zoom-settings-privacy.png), [DEMO bloqueada](evidence/T048/zoom-settings-diagnostics.png). |
| Leitura/controle em zoom     | Texto longo quebra, extremos alcançáveis e foco visível. [Início da fala](evidence/T048/zoom-transcript-start.png), [fim](evidence/T048/zoom-transcript-end.png), [cartões](evidence/T048/zoom-suggestions-start.png), [descarte](evidence/T048/zoom-dismiss.png), [revogação](evidence/T048/zoom-suggestions-end.png), [pausa](evidence/T048/zoom-paused.png).                                                    |
| Consentimento                | Captura e sugestões separadas; em zoom extremo, conteúdo e ações têm rolagens próprias, exigindo leitura por partes. [Normal](evidence/T048/consent.png), [limite](evidence/T048/zoom-consent-limit.png), [aviso inicial](evidence/T048/zoom-consent-disclosure-start.png), [fim do aviso](evidence/T048/zoom-consent-disclosure.png), [ação local](evidence/T048/zoom-consent-actions.png).                       |
| Falhas                       | Erro indicado somente na área afetada; detalhes legíveis em Preferências. [Transcrição](evidence/T048/error-transcription.png), [detalhes](evidence/T048/error-transcription-details.png), [sugestões](evidence/T048/error-suggestions.png).                                                                                                                                                                       |
| DEMO                         | Identificação offline evidente e controles alcançáveis. [Painel](evidence/T048/demo-active.png), [Diagnóstico e roteiro](evidence/T048/demo-diagnostics.png).                                                                                                                                                                                                                                                      |

Não foi reproduzida regressão funcional ou de layout que exigisse alteração no produto. O aceite abrange os cenários e dimensões acima, com as limitações abaixo.

## Limites

Revisão visual realizada pelo agente sobre imagens reais da janela Electron/macOS, com conteúdo totalmente fictício. Não é relato de ensaio manual do usuário, auditoria completa de acessibilidade, teste de VoiceOver, captura real mic/system, integração paga, sessão prolongada, múltiplos monitores ou validação universal de Spaces/tela cheia. A 200%, a janela exige rolagem e reorganiza as colunas verticalmente; os testes comprovam alcance, não exibição simultânea de todo o conteúdo. Nos seletores nativos estreitos, o valor exibido pode ser abreviado; fonte/idioma/modelo continuam selecionáveis e rotulados.

Não foram usados áudio real, credenciais pessoais, API externa, gastos, push ou deploy. Swift não foi executado porque não houve mudança nativa. T045, T049, T050, T051 e Windows permanecem fora desta sessão.
