# ADR 0002 — Gates verificáveis e CI básico (T002)

Data: 2026-11-02. Estado: aceito.

## Contexto

T001 já configurou ESLint, Prettier, TypeScript strict, Vitest/RTL e scripts npm. T002 deve provar esses controles e reproduzi-los em CI, sem iniciar IPC ou o spike Swift.

## Decisão

- Preservar versões, regras e lockfile da T001. Acrescentar testes em `tests/tooling` que submetem código inválido às ferramentas reais: variáveis não usadas, `any`, promises soltas, non-null assertions, hooks condicionais, tipos implícitos, índices potencialmente ausentes, erros `unknown` e formatação. Usar os três tsconfigs herdados e fixtures em memória, sem gerar código inválido no repositório.
- GitHub Actions executa `npm ci --ignore-scripts --no-audit --no-fund` e `npm run verify` em Ubuntu 24.04, Node definido por `.nvmrc`. Actions fixadas por SHA, permissão somente de leitura, credencial Git não persistida, sem cache, secrets ou publicação. O build não precisa baixar/iniciar o binário Electron.
- Smoke gráfico continua explícito em `npm run test:smoke`. Nenhum job Swift até existir pacote nativo e SDK compatível validado. Não adicionar jobs que passam por simplesmente pular checks ausentes.
- Registrar ferramentas Swift disponíveis e comandos futuros no README. SwiftLint/SwiftFormat estão ausentes neste Mac; não instalá-los nem escolher versões sem validar no pacote real. `swift-format` incluído no Xcode é ferramenta distinta, disponível para avaliação posterior. Não mudar a exigência dos padrões de engenharia.

## Alternativas e consequências

CI macOS com captura real exigiria SDK, sessão gráfica e permissões ainda não validados. O job genérico cobre gates JS, não capacidade Apple nem suporte de produto a Linux/Windows. A configuração hospedada precisa da primeira execução após publicação autorizada; resultados locais não são apresentados como execução do GitHub Actions. Não há dependências novas ou supressões de regras. A suíte ganha dez testes de tooling; fronteiras/IPC permanecem na T003.

## Referências

- [Checkout v6.0.2](https://github.com/actions/checkout/releases/tag/v6.0.2) e [setup-node v6.2.0](https://github.com/actions/setup-node/releases/tag/v6.2.0): releases consultadas para fixar os SHAs.
- [setup-node](https://github.com/actions/setup-node): configuração por arquivo e desativação de cache automático.
- [swift-format oficial](https://github.com/swiftlang/swift-format): ferramenta incluída no toolchain Swift; distinta de SwiftFormat.
