# Meeting Copilot

Assistente desktop de reuniões em tempo real, feito com Electron, React e TypeScript. O objetivo do MVP é executar localmente no macOS, com transcrição Apple implementada pelo projeto em Swift e sugestões de IA opcionais e autorizadas.

## Status

O scaffold desktop e a demonstração offline estão implementados. T001–T012 estão concluídas. **T013 está bloqueada** enquanto os gates nativos Swift não puderem ser executados no ambiente atual; o helper está em andamento e ainda não está integrado ao Electron. Portanto, o app ainda não oferece transcrição real integrada nem está pronto para distribuição. Windows (T036–T039) permanece adiado.

## Executar

Requer Node.js **26.0.0** (`.nvmrc`) e npm. Com `nvm` instalado:

```bash
nvm use
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run dev
```

A aplicação abre em modo `DEMO`, sem chave, rede ou captura real. Para compilar e abrir o build:

```bash
npm run build
npm start
```

Instruções adicionais de instalação, testes e gates Swift estão em [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). O roteiro de demonstração está em [docs/DEMO.md](docs/DEMO.md).

## Documentação

- [PRD](docs/PRD.md) — escopo e comportamento esperado.
- [Roadmap](docs/ROADMAP.md) e [tarefas](docs/TASKS.md) — marcos, dependências e aceite.
- [Progresso](docs/PROGRESS.md) — status atual, handoff e evidências verificadas.
- [Decisões](docs/DECISIONS.md) — decisões confirmadas e questões abertas.
- [Arquitetura](docs/ARCHITECTURE.md) — proposta técnica e fronteiras do sistema.
- [Padrões de engenharia](docs/ENGINEERING-STANDARDS.md) e [fluxo de trabalho](docs/WORKFLOW.md) — contribuições e validação.

O estado e as evidências em `docs/PROGRESS.md` prevalecem sobre qualquer descrição de arquitetura futura.
