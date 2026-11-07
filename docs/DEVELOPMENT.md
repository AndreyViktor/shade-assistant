# Desenvolvimento

## Requisitos

- Node.js **26.0.0**, conforme `.nvmrc`, e npm.
- macOS e Xcode com Swift para compilar e validar código nativo. A versão mínima suportada do macOS ainda não foi definida.
- Na primeira instalação, acesso à rede para baixar dependências e o binário oficial do Electron.

## Instalar e executar

Com `nvm` instalado:

```bash
nvm use
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run dev
```

O comando `npm ci --ignore-scripts` evita lifecycle scripts das dependências; o binário Electron é instalado explicitamente pelo comando seguinte. `npm run dev` inicia o servidor local em `127.0.0.1:5173`. Encerre com Ctrl+C.

No macOS, `npm run dev` primeiro compila o helper em `MeetingCopilotTranscriber.app`. O main pede acesso ao microfone quando o usuário inicia Apple Local com consentimento marcado. **Em desenvolvimento iniciado no Terminal/IDE, o macOS pode atribuir o acesso de áudio do sistema ao Terminal/IDE que iniciou o Electron.** Nesse caso, habilite esse app em Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela e Áudio do Sistema; feche e reabra o Terminal/IDE e o Meeting Copilot. O helper nunca concede nem contorna permissões. Um app empacotado deverá usar bundle ID e descrições TCC próprios antes da distribuição.

Para executar o build:

```bash
npm run build
npm start
```

Isso compila main, preload e renderer em `dist/` e abre o app compilado. Ainda não há instalador, assinatura ou pacote de distribuição.

## Qualidade

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:runner
npm run build
npm run verify
```

`npm run verify` agrega lint, formatação, TypeScript strict, testes Vitest, testes do runner Python e build. O teste gráfico do Electron é separado:

```bash
npm run test:smoke
```

No macOS, os gates Swift e o diagnóstico são:

```bash
npm run verify:swift
npm run probe:swift
```

O diagnóstico acessa capacidades reais do sistema; não é necessário para testes unitários. Gates Swift exigem ferramentas Apple compatíveis. Registre resultados apenas quando executados de fato; testes sintéticos não comprovam captura ou STT real.

## Segurança e estado

- Não inclua chaves, transcrições, áudio, screenshots, logs sensíveis ou `.env` no Git.
- `OPENAI_API_KEY` é aceita apenas no processo main em desenvolvimento não empacotado. Prefira o fluxo seguro de chave disponível no app; não cole segredos no renderer, em comandos registrados ou em IPC genérico.
- A demo funciona sem chave e não chama serviços pagos. Sugestões/screenshot via API e fallback remoto de STT exigem autorização e têm custos separados.
- Não habilite faturamento, faça push, conceda permissões administrativas ou altere segurança do macOS sem consentimento humano.

## Documentação de trabalho

- [WORKFLOW.md](WORKFLOW.md): Git, sessões independentes por tarefa e handoff.
- [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md): arquitetura modular, padrões e critérios de conclusão.
- [TASKS.md](TASKS.md): status e aceite. [PROGRESS.md](PROGRESS.md): snapshot e próximo passo. Consulte evidências especializadas ligadas pela tarefa; o histórico antigo está em [PROGRESS-HISTORY.md](PROGRESS-HISTORY.md).
- [DECISIONS.md](DECISIONS.md): decisões confirmadas, propostas e questões abertas.
- [ARCHITECTURE.md](ARCHITECTURE.md): desenho técnico proposto, não uma lista de recursos já integrados.
