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

No macOS, `npm run dev` primeiro compila o helper em `MeetingCopilotTranscriber.app`. O main pede acesso ao microfone quando o usuário inicia Apple Local com consentimento marcado; o helper também faz o preflight das fontes imediatamente antes da captura. **Em desenvolvimento unpackaged, o macOS pode atribuir o TCC ao Electron, Terminal/IDE responsável ou bundle auxiliar, conforme o caminho observado.** Autorize somente a entrada realmente mostrada em Ajustes do Sistema → Privacidade e Segurança e reabra o processo indicado quando o macOS exigir. Não use `tccutil`, remova Gatekeeper ou altere a assinatura para forçar um prompt. A assinatura ad hoc de desenvolvimento não comprova a identidade estável do futuro pacote; os critérios de distribuição estão no [ADR 0029](adr/0029-electron-native-security-baseline.md).

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
npm run test:helper
npm run probe:swift
```

`test:helper` reconstrói, assina e exercita lifecycle/protocolo sem iniciar captura. O diagnóstico consulta capacidades reais do sistema, mas não solicita TCC nem captura. Gates Swift exigem ferramentas Apple compatíveis. `npm run test:native-capture` é separado e só pode ser usado com autorização humana explícita, áudio sintético e sem registrar a transcrição. Registre resultados apenas quando executados de fato; testes sintéticos não comprovam captura ou STT real.

## Segurança e estado

- Não inclua chaves, transcrições, áudio, screenshots, logs sensíveis ou `.env` no Git.
- `OPENAI_API_KEY` é aceita apenas no processo main em desenvolvimento não empacotado. Prefira o fluxo seguro de chave disponível no app; não cole segredos no renderer, em comandos registrados ou em IPC genérico.
- A demo funciona sem chave e não chama serviços pagos. Sugestões/screenshot via API e fallback remoto de STT exigem autorização e têm custos separados.
- Não habilite faturamento, faça push, conceda permissões administrativas ou altere segurança do macOS sem consentimento humano.
- Para revisar dependências, use `npm audit --json` com rede autorizada e compare a versão fixada do Electron com a stable suportada. Não coloque essa consulta de rede em `npm run verify`, que permanece offline e reproduzível.

## Documentação de trabalho

- [WORKFLOW.md](WORKFLOW.md): Git, sessões independentes por tarefa e handoff.
- [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md): arquitetura modular, padrões e critérios de conclusão.
- [TASKS.md](TASKS.md): status e aceite. [PROGRESS.md](PROGRESS.md): snapshot e próximo passo. Consulte evidências especializadas ligadas pela tarefa; o histórico antigo está em [PROGRESS-HISTORY.md](PROGRESS-HISTORY.md).
- [DECISIONS.md](DECISIONS.md): decisões confirmadas, propostas e questões abertas.
- [ARCHITECTURE.md](ARCHITECTURE.md): desenho técnico proposto, não uma lista de recursos já integrados.
