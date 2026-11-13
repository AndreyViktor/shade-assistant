# T041 — Painel de reunião e janela flutuante

Data: 2026-11-12. Base `0bc1e63`, `main` inicialmente limpa. Dependências T040/T017 concluídas. Plano e `IN_PROGRESS` registrados antes de código/testes. **Aceite bloqueado**: falta ensaio manual de Spaces/tela cheia/múltiplos monitores. O foco nativo e a suíte completa passaram em nova execução em 13/11.

## Implementação e política de espaço

- Janela inicial 960×720, mínimo 640×480, moldura/controles nativos e `alwaysOnTop` preservados. Transcrição e assistência em colunas adjacentes nas duas dimensões. Log e assistência recebem foco por teclado e têm rolagem independente; textos longos e palavras sem espaços quebram dentro da coluna.
- Histórico com blocos por fonte (microfone/sistema), metadados e parcial/final preservados. Fonte não identifica pessoa. Continuam valendo a janela de até 12 segmentos e a política temporal existente; não é arquivo completo da reunião. Seguimento automático já existente permanece condicionado à leitura perto do fim. Estado vazio fica dentro da área de leitura. A legenda não afirma mais ausência de envio à OpenAI durante sessões com sugestões autorizadas.
- Capacidade continua **dois cartões**, conforme T040/ADR 0022. Na chegada de um terceiro, o store substitui o mais antigo. Espaço vertical insuficiente é tratado por rolagem: um cartão pode ficar abaixo da área visível, mas continua acessível. Resize, zoom e movimentação **não** descartam cartões nem enviam comandos de sessão. Não há cálculo de capacidade por pixels, debounce ou descarte após resize estabilizar: evita perda inesperada ao trocar monitor, mudar zoom ou ler texto longo. A regra fica disponível em “Quando os cartões são removidos?”. TTL da DEMO e limpeza por pausa/stop/revogação continuam iguais.
- Em largura CSS até 520 px (por exemplo zoom 200% no mínimo nativo), as colunas refluem verticalmente para manter texto/controles acessíveis, sem overflow horizontal. Em tamanho nativo normal/mínimo ficam lado a lado. Na altura mínima pode ser necessário rolar o documento para ver todo o painel ou os controles.
- No macOS, `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` é chamado uma vez, antes de mostrar a janela. Não altera política de ativação, níveis acima do Dock, permissões, segurança Electron ou IPC. A API solicita presença nos Spaces/tela cheia; seu getter não prova visibilidade real sobre outro aplicativo. A transformação de tipo de processo padrão pode ocultar brevemente janela/Dock, razão para não repeti-la em resize/foco. Referência: [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window#winsetvisibleonallworkspacesvisible-options).

## Testes e evidências

- `createMainWindow.test.ts`: dimensões e segurança, configuração de Spaces apenas no macOS e antes do carregamento do renderer; demais plataformas não recebem a chamada.
- `meeting-workspace.spec.ts`: helper JSONL e transporte Responses sintéticos; oito falas longas e dois cartões, ou nenhuma fala/cartão. Verifica geometria em 960×720 e 640×480, ausência de overflow horizontal, foco DOM, teclado/rolagem, resize ida/volta, zoom, snapshot sem perda de sessão/cartões, movimento por API nativa, descarte por teclado, pausa/retomada/parada e zero tentativas de rede.
- `panel.spec.ts` mantém o gate de foco nativo, minimizar/restaurar e reabrir. Não foi desabilitado nem enfraquecido para esconder a falha. Consulta `isAlwaysOnTop()` e `isVisibleOnAllWorkspaces()`; esses getters não substituem observação dos Spaces.
- `local-transcript.spec.ts` abre o aviso recolhido sobre histórico antes de conferir seu texto. Testes anteriores de sugestões, lifecycle, consentimento, retenção e segurança permanecem.

### Gates executados

- `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`: aprovado; lint/formato/tipos, **808 TS aprovados / 18 skipped**, 46 arquivos aprovados / 3 skipped, **19 testes do runner**, build main/preload/renderer. Os skipped não comprovam ensaio manual.
- `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run test:smoke`: **17/19 aprovados**, 2,2 min; falhas de rolagem e foco nativo. Após corrigir a corrida entre Home/PageDown, o smoke focado de layout passou. Foco nativo foi repetido e continuou falhando; suíte completa não declarada aprovada.
- `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npx playwright test tests/e2e/meeting-workspace.spec.ts`: **2/2 aprovados**, com normal/mínimo, vazio/falas longas, zoom 200%, foco/rolagem DOM, movimento, retenção e cleanup. Executado fora do sandbox com revisão aprovada, perfil temporário e guardas de rede. Esse smoke não comprova foco Cocoa.
- Última revisão de testes/documentos: lint/formato/tipos e smoke focado repetidos; resultados registrados no handoff. Logs `/private/tmp/t041-verify.log`, `t041-smoke.log`, `t041-focused-smoke.log`, `t041-focus-diagnostic2.log` e `t041-layout-final.log` são locais temporários.

### Evidência visual inspecionada

Capturas versionadas da página Electron com dados fictícios, nunca do desktop ou de reunião real. A captura no tamanho mínimo mostra os controles e as duas colunas; textos/cartões que excedem a altura permanecem acessíveis por rolagem.

- [Falas longas e cartões — 960×720](evidence/T041/meeting-long-960.png).
- [Falas longas e cartões — 640×480](evidence/T041/meeting-long-640.png).
- [Estado vazio — 960×720](evidence/T041/meeting-empty-960.png).
- [Estado vazio — 640×480](evidence/T041/meeting-empty-640.png).

A inspeção visual foi da imagem do renderer; não observou sobreposição com outros aplicativos, Spaces ou tela cheia.

## Diagnóstico do bloqueio nativo

macOS 26.6.2 (25G83), Electron 45.2.1, Node 26. Uma sondagem temporária observou **um display** via `screen.getAllDisplays()` e `win.isFocused() === false` mesmo após `app.focus({ steal: true })`/`win.focus()`. Reproduziu também com uma **nova BrowserWindow padrão**, sem `setVisibleOnAllWorkspaces`; portanto há indício de limitação do ambiente, não prova de defeito específico da nova configuração. A janela estava visível e focável; foco DOM e comandos Playwright funcionaram. A sondagem não alterou preferências do SO, não capturou desktop e foi removida após diagnóstico. Não inferir que foco nativo funciona para o usuário a partir desses resultados.

Primeiras passagens encontraram um narrowing TypeScript de coordenadas, ocultação de cartões com snapshot local ainda nulo e uma corrida de animações Home/PageDown no teste de rolagem. Corrigidos sem suavizar contratos ou regras. A falha de foco nativo continua pendente.

## Retomada — 2026-11-13

A pedido do usuário, o teste de foco nativo `panel.spec.ts` foi repetido em sessão Electron fora do sandbox e passou (1/1), incluindo foco, minimizar/restaurar, teclado e redimensionamento. Em seguida, `npm run test:smoke` completo passou (19/19, 2,1 min), com perfil temporário, fixtures sintéticas e rede bloqueada. A causa da falha anterior não foi identificada; sua aprovação posterior demonstra o resultado desta execução, não elimina possibilidade de falha intermitente.

Os testes de troca real de Spaces, outro app em tela cheia, arraste humano e múltiplos monitores continuam pendentes de confirmação. Nenhum conteúdo real, chave ou captura de áudio foi usado pelo agente.

## Desbloqueio e ensaio manual pendente

Executar em sessão gráfica interativa do Mac, com dois monitores, e registrar versão do macOS, dimensões/escalas e configuração de Spaces. Usar dados fictícios e DEMO offline para a janela; as fixtures de `meeting-workspace.spec.ts` exercitam o layout real sem áudio/API. Não iniciar captura ou envio real sem autorização separada.

| Cenário                   | Critério                                                                                 | Estado                                      |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| Foco nativo e controles   | Reexecutar `panel.spec.ts`; foco, minimizar/restaurar e reabrir passam                   | Aprovado em 13/11 (1/1 e smoke 19/19)       |
| Troca de Spaces           | Painel permanece acessível ao alternar desktops e apps; sessão preservada                | Não observado                               |
| Outro app em tela cheia   | Avaliar painel sobre app macOS em tela cheia, entrada/saída e interação                  | Não observado                               |
| Múltiplos monitores       | Mover entre displays, trocar Spaces em cada um, redimensionar e usar controles sem perda | Não executado — apenas um display observado |
| Arrastar moldura e bordas | Movimento/resize humanos sem perda da sessão, além do teste por API                      | Não observado                               |

Sem a evidência manual dos cenários restantes, T041 permanece `BLOCKED`; T042 não começa. Não há promessa de visibilidade universal, proteção de compartilhamento ou suporte a todos os modos de tela cheia/gerenciadores de janelas.

Não houve captura real, chamadas OpenAI, acesso a credenciais reais, custos, instalação, push ou deploy. Swift não mudou; gates Swift não repetidos. Logs locais em `/private/tmp/t041-*.log` são temporários e não são evidência de reunião real.
