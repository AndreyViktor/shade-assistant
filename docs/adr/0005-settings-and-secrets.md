# ADR 0005 — Preferências e segredos restritos ao main

Data: 2026-11-03. Tarefa: T004. Estado: aceito.

## Contexto

A T004 exige preferências persistentes, Apple Swift como padrão Mac e chave ausente do renderer. Captura, capacidades/idiomas reais, consentimento e providers pertencem às tarefas posteriores. Não existe formulário seguro para digitar uma chave no React sem colocá-la no renderer.

## Decisão

- `Preferences` v1 em `contracts/settings`: modo preferido `demo|real`, STT `apple-local|mock`, idioma `pt-BR|en-US|pt-BR+en-US`. Defaults: DEMO, pt-BR e Apple local no Mac; mock nas demais plataformas. Preferência não comprova capacidade nem inicia serviço. O status operacional continua DEMO/inativo. Opção remota visível mas desabilitada; schema rejeita `openai-stt` até consentimento/provider da T015/T016. Não persistimos autorizações futuras.
- `PreferencesStore` em infraestrutura grava `preferences.v1.json` em `app.getPath('userData')`. Schema estrito, leitura limitada a 4 KiB, escrita temporária exclusiva + sync + rename, arquivo 0600; pasta criada 0700. Ausência usa defaults. Arquivo inválido/versão desconhecida/falha de IO gera erro seguro sem sobrescrever silenciosamente o original. Sem transcrição, áudio ou imagem.
- `SecretStore` separado recebe a interface pequena de criptografia, implementada por `safeStorage` na composição do main. Usa API assíncrona disponível no Electron 45.2.1 instalado; cifra em `openai-key.enc`, nunca nas preferências. Sem cifra disponível ou fora do Mac, falha fechada; não habilitamos backend plaintext. `get/set/remove/has` são internos, sem método público de leitura da chave. `get` verifica retorno e recriptografa quando `shouldReEncrypt` é informado. Erros de armazenamento são normalizados sem preservar conteúdo/cause privado.
- Importação explícita abre `dialog.showOpenDialog` no main e lê somente o arquivo escolhido (regular, até 4 KiB), removendo espaços nas extremidades. Não aceita chave, caminho ou ciphertext do renderer. O arquivo original permanece no local escolhido, como avisado na UI; o app não o remove automaticamente. Cancelamento não altera o cofre. Remoção apaga somente o ciphertext do app. Nenhuma importação valida a chave na rede.
- `OPENAI_API_KEY` é reconhecida apenas quando `app.isPackaged` é falso; não é copiada para disco nem devolvida à UI. Sua presença tem precedência no indicador; em desenvolvimento, a UI orienta removê-la do ambiente e reiniciar. Nenhum provider consome credenciais nesta tarefa.
- IPC adicional `meeting-copilot:settings` v1 com ações fechadas `read/save/import-secret/remove-secret`. A API congelada expõe `getSettings/savePreferences/importSecret/removeSecret`, além do `getStatus` existente. Validação estrita dos dois lados, autorização reutilizada por janela/frame/URL e rechecagem após await. Resposta contém somente preferências e `missing|stored|development`. `stored` indica existência, não validade/descriptografia bem-sucedida.
- Composição serializa operações de uma janela e recusa concorrência enquanto o seletor está aberto. Preload limita espera a 5 s (importação: 5 min). Timeout de IPC não cancela operação já iniciada; UI orienta reabrir para conferir o estado, sem afirmar que a escrita falhou. Encerramento da janela durante seleção impede importação posterior.

## Alternativas e consequências

Formulário React foi descartado por expor a chave ao renderer. Biblioteca adicional de Keychain/CLI `security` não é necessária para esta fatia; safeStorage já está no Electron. Arquivo JSON único com chave foi descartado. Não introduzimos framework de estado, dependências novas, providers vazios ou alterações nas fronteiras de imports.

O arquivo de importação contém plaintext e continua sob responsabilidade do usuário. Strings JS não têm apagamento de memória garantido. A proteção do ciphertext depende do Keychain e da identidade/assinatura do app; distribuição e migração de assinatura precisam de validação na T034. O MVP falha fechado fora do Mac, sem iniciar trabalho de Windows. Modelos OpenAI e consentimento/custos não são configurados nem usados nesta tarefa.

## Validação

Testes de contrato, disco temporário, cifra simulada, IPC/main/preload e RTL cobrem defaults, reabertura, corrupção, limites, indisponibilidade, cancelamento, concorrência, remoção e redaction. Smoke Electron usa bootstrap/perfil temporários e remove `OPENAI_API_KEY` do ambiente filho. Testa persistência após reinício e, no Mac, cifra/decifra real do safeStorage com valor sintético; apenas o seletor de arquivo é simulado. Resultados reais em `docs/PROGRESS.md`.

## Referências verificadas

API assíncrona e proteção via Keychain: [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage). Seletor nativo no main: [Electron dialog](https://www.electronjs.org/docs/latest/api/dialog). Assinaturas conferidas também em `node_modules/electron/electron.d.ts` da versão instalada.
