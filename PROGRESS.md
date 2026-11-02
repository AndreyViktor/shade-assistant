# Progresso e handoff — Meeting Copilot V0.7

**Atualização:** 2026-11-02 — revisão arquitetural e de qualidade **somente dos documentos**, sem executar implementação.  
**Marco atual:** M0 — fundação + viabilidade Swift.  
**Próxima tarefa:** T001 (`T005` na sequência, assim que houver scaffold).  
**Concluídas:** nenhuma. **Em andamento:** nenhuma.  
**Escopo:** 35 tarefas MVP + 4 tarefas futuras Windows (`DEFERRED`). **Ainda não há código executável da aplicação neste pacote.**

## Revisão de engenharia V0.7 (documentação apenas)
- Adicionado `ENGINEERING-STANDARDS.md`: arquitetura modular simples, estrutura de diretórios e dependências, convenções React/TS/Swift, ESLint, Prettier, TypeScript strict, Vitest/RTL, Swift tests, segurança, checks e Definition of Done.
- Atualizados `ARCHITECTURE.md`, `AGENTS.md`, `PROMPT-CODEX.md`, `TASKS.md` e `ROADMAP.md` para exigir padrões desde T001–T003; nenhum lint, build ou teste do aplicativo foi executado porque código ainda não existe.
- **Todas as tarefas continuam TODO/DEFERRED**; decisões de qualidade não representam implementação.

## Decisão consolidada
- A viabilidade de STT local Apple teve um **teste exploratório externo**; o produto **não depende de um binário de STT externo**.
- MVP macOS usará **helper nativo Swift próprio** para microfone + áudio do sistema com `SpeechAnalyzer`/`SpeechTranscriber` e `ScreenCaptureKit` (ou alternativas Apple verificadas), comunicado ao Electron main. React exibe transcrição e sugestões.
- Idiomas iniciais: `pt-BR` e opção `pt-BR+en-US`, com detecção/troca bilíngue a avaliar **novamente** no código próprio.
- OpenAI para sugestões/screenshot autorizados; STT remoto só fallback consentido; demo offline sem chave. Windows adiado a M6.

## Evidência da conversa — não é teste do aplicativo
- Em execução manual de uma POC externa no Mac, usuário viu boa transcrição de microfone + áudio do computador em português, com pontuação adequada.
- Opção `pt-BR,en-US` em POC externa: confusões em alguns trechos; avaliação subjetiva do usuário de ~80% de resultado adequado (sem benchmark). Detalhes no arquivo `docs/REFERENCIA-STT-APPLE.md`.
- **Não realizados neste pacote:** teste Swift próprio, testes `SpeechTranscriber`/`ScreenCaptureKit` implementados, integração Swift↔Electron, validação JSONL própria, build, teste de API real, empacotamento, Windows.

## Próximas validações reais
1. T001–T003: iniciar repo Electron + React + TS e requisitos de segurança.
2. T005: em Mac com Xcode/Swift, detectar versões/compatibilidade Apple, idiomas e permissões.
3. T006: POC mic e sistema em Swift; testar modelo por idioma, sincronização, eco/duplicações, latência e modo bilíngue.
4. T012–T014 e T017: criar protocolo e helper Swift, integrar via Electron main → IPC → renderer.
5. Medir estabilidade e recursos. Somente após isso considerar M2 validado.

## Bloqueios conhecidos para testes reais
- Necessidade de Mac compatível e autorizações de microfone, captura de áudio do sistema/screen recording e eventual Speech Recognition.
- Disponibilidade de idioma/assets e suporte ao SDK na configuração de Xcode/macOS instalada; não assumir que uma POC externa prova suporte em todo dispositivo.
- Chave e faturamento OpenAI para testar sugestões reais; não necessários para M0/M1/POC local.
- Consentimento para uso de áudio de participantes de reuniões reais.

## Registro padrão de tarefa
```text
Data/contexto:
Tarefa escolhida:
Arquivos alterados:
Comandos executados e resultados verificáveis:
Teste manual realmente realizado (ou não realizado):
Uso de API e limites (se houver):
Commit:
Bloqueios e como desbloquear:
Próxima tarefa elegível:
```

## Retomada
Ler `AGENTS.md`, `ENGINEERING-STANDARDS.md`, `DECISIONS.md`, `ROADMAP.md`, `TASKS.md` e este arquivo; comparar com código/`git status`. Não marcar tarefa como concluída com base apenas nesta documentação ou em testes exploratórios externos.

## Revisão de fluxo V0.7 — documentação e automação local (sem implementação do app)
- Definido em `WORKFLOW.md` o versionamento em `main` e commit local por tarefa **DONE**, com ID de tarefa no título; não há commits de tarefa nem repositório inicializado neste pacote ZIP.
- Definida execução em **sessões novas por tarefa**. Incluído `scripts/run-codex-tasks.py` (Python stdlib) para selecionar a próxima tarefa elegível, invocar novo `codex exec` limitado a uma tarefa e validar estado `DONE`, commit com ID e working tree limpa antes de próxima execução opcional.
- Próxima tarefa permanece **T001**. Nenhum código do Meeting Copilot foi implementado/testado, e o runner **não foi executado contra o Codex no macOS**. `--dry-run` e testes da lógica do script são verificações locais separadas.
- Próximo passo do usuário: extrair V0.7 no Mac, instalar/autenticar Codex, criar commit base Git e rodar o executor com 1 tarefa; inspecionar resultados antes de aumentar `--max-tasks`.
