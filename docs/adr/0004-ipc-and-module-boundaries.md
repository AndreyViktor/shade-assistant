# ADR 0004 — Fronteiras de módulos e IPC mínimo

Data: 2026-11-03. Tarefa: T003. Estado: aceito.

## Contexto

O scaffold tinha isolamento Electron e restrições básicas de imports no renderer, mas não tinha preload nem contrato IPC. A T003 precisa provar a fronteira sem implementar configurações, sessões ou transcrição de outras tarefas.

## Decisão

- Expor somente `window.meetingCopilot.getStatus()`. Um único canal, `meeting-copilot:app-status`, consulta o estado público do scaffold: demo, captura inativa, IA desativada, nenhum dado enviado. O renderer consome essa resposta e apresenta espera/erro acessível se não puder verificá-la.
- Contratos em `src/contracts/ipc/appStatus.ts`, compartilhados por main, preload e renderer. Request `{version: 1}` e resposta discriminada `{version: 1, ok: true, status}` ou `{version: 1, ok: false, code}`. Validadores manuais exigem chaves exatas e valores finitos allowlisted; nenhuma string livre, payload de reunião, stack, chave ou caminho é aceito. Esse schema tem tamanho aceito limitado pela própria forma, sem serializar entradas arbitrárias para medir bytes. Novos campos/operações exigem atualização de contrato, consumidores e testes.
- Main aceita um argumento somente, valida versão e autoriza por identidade de WebContents, identidade do frame principal e URL exata esperada (arquivo local ou loopback de desenvolvimento). Fecha o handler ao fechar a janela, permitindo recriação pelo lifecycle macOS. Canais desconhecidos não têm handler.
- Preload gera o request, rejeita argumentos extras, valida a resposta e normaliza falhas de transporte. Timeout de cinco segundos evita espera indefinida; conclusão tardia não altera a UI. Leituras concorrentes são independentes e sem efeitos; não há eventos/listeners públicos nem ordenação de stream nesta tarefa.
- Preload compilado em um bundle pelo electron-vite e carregado com sandbox, isolamento de contexto e webSecurity ativos, Node desativado no renderer. Permissões de captura continuam negadas.
- ESLint aplica regra local aos seis módulos, normalizando caminhos relativos e examinando imports, re-exports, import types, imports dinâmicos e require. Caminhos dinâmicos e pacotes/aliases fora da allowlist são rejeitados. Pacotes externos de integração devem ser autorizados na regra quando implementados. Testes virtuais exercitam também camadas ainda sem arquivos.

| Origem         | Imports locais permitidos             |
| -------------- | ------------------------------------- |
| contracts      | contracts                             |
| core           | core, contracts                       |
| infrastructure | infrastructure, core, contracts       |
| main           | main, infrastructure, core, contracts |
| preload        | preload, contracts                    |
| renderer       | renderer, contracts                   |

`core` e `infrastructure` continuam sem implementações: não há regra de domínio ou adaptador externo necessário para consultar o estado estático do scaffold. Criar classes/pastas vazias não acrescentaria evidência. As fronteiras já estão configuradas e testadas para esses diretórios.

## Alternativas

Um `invoke(channel, payload)` público ampliaria desnecessariamente a superfície privilegiada. Schemas de sessões/STT antecipariam T008/T012 sem consumidor real. Uma biblioteca de schemas não se justifica para este contrato finito; reavaliar quando surgirem estruturas maiores. Regex de imports isolada não normaliza travessias de diretório nem cobre todas as formas de importação.

## Consequências e validação

Testes cobrem contratos inválidos, versões, campos extras/grandes, origem/frame, ciclo do handler, erros redigidos, timeout e imports permitidos/proibidos. Smoke real comprova carregamento do preload, consulta renderer → main → renderer, superfície restrita, recarga offline e bloqueio de popup. Configuração de segurança também tem teste unitário. Isso não comprova captura, STT, API OpenAI ou demo de reunião. JSONL e streams continuam na T012.

Referências oficiais consultadas nesta tarefa: [segurança e validação de sender](https://www.electronjs.org/docs/latest/tutorial/security), [IPC via métodos específicos](https://www.electronjs.org/docs/latest/tutorial/ipc) e [bundle de preload com sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox).
