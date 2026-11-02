# ADR 0001 — Build e fundação desktop da T001

Data: 2026-11-02. Estado: aceito.

## Contexto

O repositório tinha apenas planejamento e runner Python. T001 precisa abrir um app real e estabelecer checks, preservando os limites das camadas sem antecipar IPC, captura ou providers.

## Decisão

- Um pacote npm com Electron, React e TypeScript strict; electron-vite compila main em CommonJS e renderer para navegador. Vite/React fazem HMR somente no loopback, em porta fixa. O build usa arquivos locais e CSP sem conexões.
- Node 26.0.0 já disponível no Mac é a referência de desenvolvimento (`.nvmrc`); engines bloqueia Node 20. Dependências diretas fixadas e lockfile npm único. Nenhuma instalação global alterada.
- Vitest 4.1.12 é fixado porque Vitest 5.1.0 apresentou incompatibilidade verificável em `Assertion` com os tipos de jest-dom 7.0.1. TypeScript 5.9.3 e `skipLibCheck: false` preservam a verificação; não foram suprimidos erros de tipos.
- ESLint com análise de tipos, React Hooks e imports proibidos do renderer; Prettier; Vitest/RTL; smoke com Playwright usando o binário Electron. Configurações TS separadas. `DOM` no tsconfig do main atende tipos públicos do Electron (`VideoFrame`/`HTMLElement`), sem disponibilizar Node ao renderer em runtime.
- `@swc/core` é dependência de desenvolvimento porque os tipos públicos de electron-vite o importam mesmo quando o transformador não é usado; instalá-lo mantém o typecheck completo sem stubs ou `skipLibCheck`.
- Somente main e renderer têm implementação nesta etapa. Preload/contratos entram na T003; domínio, adaptadores e Swift entram nas tarefas correspondentes, sem diretórios ou interfaces vazias.
- Instalar com `npm ci --ignore-scripts` e executar explicitamente o instalador oficial de Electron, inspecionado, que valida checksum. Nenhum outro lifecycle script é necessário para os gates desta versão.
- Override transitivo de `minimatch` para **11.0.1**: auditoria inicial apontou GHSA-g3hv-75wg-m249 na árvore de ESLint/typescript-eslint. O upstream corrigiu nessa versão; validar compatibilidade pelos gates e remover o override quando os consumidores adotarem a correção. Não aplicar os downgrades incompatíveis sugeridos por `npm audit fix --force`.

## Alternativas

Vite + scripts próprios de watcher/build gerariam mais coordenação entre processos. Electron Forge adicionaria empacotamento antes de T034. Ambos permanecem opções se a distribuição exigir revisão. Não foi criado framework de estado, backend ou bridge genérica.

## Consequências

App local executável, sem capacidade de captura ou acesso a segredos. O smoke exige desktop gráfico; build não prova assinatura nem compatibilidade Swift. A restrição básica de imports não substitui os testes de fronteiras e contratos de T003. T002 continua responsável por revisar os gates, CI e tooling Swift. Exceções CSP para React Refresh e estilos são restritas a `serve` e não aparecem no HTML de produção. O aviso `preload config is missing` do electron-vite é esperado nesta etapa: não há API IPC nem preload para compilar; não foi silenciado.

## Referências consultadas

- [electron-vite: configuração e ambientes](https://electron-vite.org/guide/)
- [Electron: recomendações de segurança](https://www.electronjs.org/docs/latest/tutorial/security)
- [Playwright: automação Electron](https://playwright.dev/docs/api/class-electron)
- [Advisory minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) e [correção upstream 11.0.1](https://github.com/isaacs/minimatch/releases/tag/v11.0.1)

Versões/engines também foram consultados no registro npm e confirmados na instalação e no lockfile; evidências da execução ficam em `docs/PROGRESS.md`.
