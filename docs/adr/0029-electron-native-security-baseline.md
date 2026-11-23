# ADR 0029 — Baseline Electron, TCC e assinatura do helper nativo

Data: 2026-11-23. Escopo: T032.

## Contexto

O fluxo local combina um renderer Electron, um processo main com IPC/segredos e o bundle Swift `MeetingCopilotTranscriber.app`, que solicita microfone, reconhecimento de fala e áudio do sistema. T032 precisa tornar essa fronteira auditável antes do empacotamento, sem confundir a assinatura ad hoc de desenvolvimento com identidade de distribuição nem antecipar STT remoto, screenshot ou os fuses do artefato final.

## Decisão

### Electron e IPC

- Produção carrega somente o arquivo local do renderer; desenvolvimento aceita exatamente `http://127.0.0.1:5173/`, sem credenciais, outra porta, caminho, query ou fragmento. A janela usa partição não persistente, `contextIsolation`, sandbox e `webSecurity`; Node, webview, conteúdo inseguro, features experimentais, integração em worker/subframe e navegação por drag-and-drop ficam explicitamente desativados.
- A sessão do renderer nega toda permissão web. Captura continua exclusiva do helper Swift após consentimento da sessão. Popups, navegação e redirects são bloqueados; a CSP de produção usa `default-src 'none'`, código/estilo/fontes/imagens locais e `connect-src 'none'`. A exceção de Vite existe somente no servidor loopback de desenvolvimento.
- O preload expõe somente métodos tipados e congelados com canais fixos. Todo handler valida quantidade/schema, janela, `webContents`, frame principal e URL exata antes e, quando há `await`, depois da operação. Erros de borda retornam códigos estáveis sem causa, payload ou stack.

### TCC, bundle e entitlements

- O helper mantém o bundle ID `local.meetingcopilot.transcriber`, `LSUIElement=true` e descrições específicas para microfone, áudio do sistema/tela e Speech. Ele próprio consulta/solicita TCC somente depois do comando `start`; nenhum teste ou probe concede, reseta ou contorna permissões.
- Em desenvolvimento unpackaged, a identidade exibida pelo TCC pode ser o Electron, Terminal ou IDE responsável, além do bundle auxiliar, conforme o caminho que solicita o recurso. A assinatura ad hoc muda a cada build e não comprova identidade estável. A documentação deve dizer qual processo foi observado, nunca prometer atribuição universal.
- O helper de desenvolvimento é assinado diretamente, sem `--deep`, com hardened runtime ad hoc e **sem entitlements**. As descrições de uso acionam TCC; não são privilégios. Não habilitamos App Sandbox nesta fase. Se uma distribuição futura escolher App Sandbox/MAS, `com.apple.security.device.audio-input` e herança de sandbox só podem ser adicionados após decisão e ensaio próprios; não há entitlement para ignorar TCC de ScreenCaptureKit.
- T034 só pode aceitar distribuição quando o app externo e todo código aninhado tiverem identificadores estáveis, mesma identidade Developer ID válida, hardened runtime, timestamp seguro, assinatura verificada de dentro para fora, notarização/staple e ensaio em Mac limpo. O `Info.plist` do app externo também deve declarar os usos que ele próprio solicita. Exceções JIT exigidas pelos helpers oficiais do Electron ficam limitadas aos executáveis que realmente as necessitam; o transcritor Swift não recebe JIT, rede, arquivos amplos, automação, disable-library-validation ou acesso administrativo. T072 auditará fuses/ASAR e o artefato final.

### Dados, processos e dependências

- Áudio não cruza o processo Swift: buffers PCM são efêmeros, limitados a 32 e uma fila cheia falha fechada. JSONL aceita até 16 KiB por frame e texto até 4.096 unidades; stderr é drenado, não retido nem encaminhado, e excesso encerra o provider. O helper recebe ambiente mínimo, sem chave OpenAI, usa `shell: false` e é terminado no stop, reload, crash, fechamento e quit coordenado.
- Transcrição/contexto/cartões ficam em memória, com limites já testados, e são limpos na revogação/parada/falha aplicável. Logs do produto usam somente mensagens/códigos fixos. A chave fica no main, cifrada por `safeStorage` em arquivo privado; build empacotado ignora `.env` e variável exportada. IPC e renderer recebem apenas metadado de presença.
- Electron fica fixado em patch stable auditado e o lockfile exige URL HTTPS e integridade. `npm audit` é evidência de rede executada, não entra em `verify` offline. SwiftPM não possui dependências externas. Atualizações futuras repetem advisories, testes e smoke em vez de relaxar a baseline.

## Alternativas e limites

Assinar recursivamente com `--deep` foi rejeitado porque pode esconder layout ou assinatura interna incorretos. Entitlements amplos ou App Sandbox especulativo foram rejeitados: privilégio mínimo depende do canal real de distribuição. Desabilitar DevTools/fuses e exigir ASAR pertencem ao artefato empacotado de T072, não ao build de desenvolvimento.

Os testes automatizados comprovam configuração, fronteiras, limites e lifecycle sintético; a assinatura ad hoc comprova apenas integridade local do bundle reconstruído. Eles não comprovam Developer ID, notarização, Mac limpo, prompt TCC inicial nem comportamento após falha do SO. Captura física requer autorização humana explícita e dados sintéticos. Evidências em [T032.md](../evidence/tasks/T032.md).

Referências oficiais: [checklist de segurança Electron](https://www.electronjs.org/docs/latest/tutorial/security), [sandbox do Electron](https://www.electronjs.org/docs/latest/tutorial/sandbox), [assinatura de código Electron](https://www.electronjs.org/docs/latest/tutorial/code-signing) e [autorização de captura no macOS](https://developer.apple.com/documentation/bundleresources/requesting-authorization-for-media-capture-on-macos).
