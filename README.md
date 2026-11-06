# Meeting Copilot

Assistente desktop de reuniões em tempo real, feito com Electron, React e TypeScript. O objetivo do MVP é executar localmente no macOS, com transcrição Apple implementada pelo projeto em Swift e sugestões de IA opcionais e autorizadas.

## Status

O scaffold desktop, a demonstração offline e a integração do helper Swift ao Electron estão implementados. Apple Local agora exibe falas recentes no overlay (T017), com fonte, idioma e estado; o aceite manual desta entrega está registrado em `docs/PROGRESS.md`. A T016, fallback OpenAI STT, está adiada. O app não está pronto para distribuição. Windows (T036–T039) permanece adiado.

## Executar

Requer Node.js **26.0.0** (`.nvmrc`) e npm. Com `nvm` instalado:

```bash
nvm use
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run dev
```

No macOS, `npm run dev` também compila o helper Swift dentro de um app nativo com descrições de uso do microfone e do áudio do sistema. A aplicação abre sem captura ativa, com Apple Local como ação principal e DEMO disponível como simulação. Apple Local só solicita permissões após seleção do modo, consentimento explícito e início da sessão. A primeira autorização de gravação de tela/áudio pode exigir aprovação em Ajustes do Sistema e reabertura do Meeting Copilot. Para compilar e abrir o build:

```bash
npm run build
npm start
```

Instruções adicionais de instalação, testes e gates Swift estão em [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). O roteiro de demonstração está em [docs/DEMO.md](docs/DEMO.md). O ensaio real da transcrição no overlay está em [docs/TEST-T017.md](docs/TEST-T017.md).

## Documentação

- [PRD](docs/PRD.md) — escopo e comportamento esperado.
- [Roadmap](docs/ROADMAP.md) e [tarefas](docs/TASKS.md) — marcos, dependências e aceite.
- [Progresso](docs/PROGRESS.md) — status atual, handoff e evidências verificadas.
- [Decisões](docs/DECISIONS.md) — decisões confirmadas e questões abertas.
- [Arquitetura](docs/ARCHITECTURE.md) — proposta técnica e fronteiras do sistema.
- [Padrões de engenharia](docs/ENGINEERING-STANDARDS.md) e [fluxo de trabalho](docs/WORKFLOW.md) — contribuições e validação.

O estado e as evidências em `docs/PROGRESS.md` prevalecem sobre qualquer descrição de arquitetura futura.
