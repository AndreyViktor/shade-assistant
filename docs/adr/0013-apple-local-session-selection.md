# ADR 0013 — Seleção de sessão Apple Local com consentimento explícito

**Data:** 2026-11-05. **Estado:** aceito para T015.

## Contexto

O provider Apple Local e a ponte com o helper existem desde T014, mas o início de sessão do app ainda permitia somente DEMO. A seleção de provider é uma ação por sessão; preferências persistidas não podem implicar autorização para capturar áudio. T016, adapter OpenAI STT, foi adiada pelo usuário.

## Decisão

- DEMO segue como caminho sem captura, rede ou custo.
- Apple Local só inicia em macOS depois de consentimento explícito não pré-marcado no painel. A solicitação inclui locale suportado (`pt-BR` ou `en-US`) e uma ou duas fontes distintas (`mic`/`system`). O contrato rejeita áudio remoto para o modo local.
- A interface mantém Apple Local como ação principal e move DEMO para uma seção secundária de simulação. O consentimento por sessão é uma confirmação imediatamente antes de iniciar, com fontes/idioma resumidos; não usa um checkbox que possa ser confundido com a permissão TCC do macOS.
- Main valida a requisição IPC e a plataforma antes de instanciar o provider; cria o ID da sessão e controla start/pause/resume/stop. Após o início explícito, main solicita microfone e o helper usa a API do macOS para solicitar acesso a gravação de tela/áudio; a aprovação continua manual em Ajustes do Sistema. O helper possui descrições TCC próprias, mas isso não substitui a identidade do processo responsável quando iniciado como subprocesso de desenvolvimento. Erros nativos são mapeados para códigos seguros, sem propagar texto arbitrário do helper.
- Preferências podem sugerir Apple Local como seleção visual, mas não iniciam a sessão nem autorizam captura. O consentimento do checkbox é consumido ao iniciar e precisa ser dado novamente em outra sessão.
- OpenAI STT continua desativado e retorna `REMOTE_STT_DEFERRED` enquanto T016 estiver `DEFERRED`.
- A T015 não exibe transcrição: fluxo de eventos até a UI pertence à T017.

## Consequências e validação

O provider T014 pode ser selecionado sem acoplar o core à UI/Electron. A captura continua dentro do helper Swift local. Mudanças no limite de consentimento ficam cobertas por testes do contrato, IPC e UI. A execução anterior mostrou que o helper com plist próprio não garante um prompt quando a aplicação é iniciada como subprocesso via Terminal. O Electron documenta que permissões de áudio do sistema podem ser atribuídas ao Terminal/IDE responsável no modo unpackaged. T015 fica em andamento até teste manual confirmar o fluxo de microfone via main e o acesso do Terminal ao áudio do sistema, ou até a execução por app empacotado. `npm run verify` e gates nativos registrados em `docs/PROGRESS.md` passaram após a correção.
