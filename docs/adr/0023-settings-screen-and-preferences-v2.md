# ADR 0023 — Tela de preferências e migração v2

Data: 2026-11-13. Tarefa: T042. Estado: implementado; validação em [TEST-T042.md](../TEST-T042.md).

## Contexto

Idioma e modelo estavam espalhados entre o painel e o diálogo de início. Preferências v1 não guardavam modelo; reabrir a confirmação restaurava o padrão. Configuração persistente não pode autorizar captura, envio ou gastos futuros.

## Decisão

- A navegação troca a tela visível dentro da mesma janela. O painel e seu hook de sessão permanecem montados e atualizados; abrir preferências não pausa, reinicia ou encerra a sessão. Retorno por botão/Escape restaura o foco. A tela carrega ao primeiro acesso explícito e preserva rascunhos ao sair/voltar.
- Idioma, fornecedores por capacidade e modelo ficam na tela de preferências. A confirmação de início resume idioma/modelo e exige novamente opt-in de texto/custo e limite (1–100; inicial 10). Fonte de áudio continua uma escolha de captura por sessão. Gerenciar a chave usa somente a importação/remoção existentes no main; `.env` continua exclusivo do desenvolvimento. Não há input de chave no renderer.
- `Preferences` v2 adiciona `suggestionProvider: openai` e `suggestionModel`, limitado ao catálogo já existente (`gpt-5.4-mini`, `gpt-5.4`). O catálogo compartilhado organiza fornecedores por capacidade: Apple Local para transcrição e OpenAI para sugestões. STT OpenAI aparece indisponível e não é aceito pelo schema. Novos fornecedores exigem implementação e validação explícitas; nenhum adapter vazio ou fallback é adicionado.
- `PreferencesStore` migra somente v1 estrita, no main, para v2 com o mesmo arquivo histórico `preferences.v1.json`. O nome é mantido para descobrir instalações existentes; o campo `version` define o conteúdo. A escrita reutiliza arquivo temporário exclusivo, sync, rename e modo 0600. Leitura posterior de v2 não regrava. Corrupção, campos extras e versões desconhecidas falham sem substituir o original.
- Migração preserva `mode`, `sttProvider` e idiomas individuais. O modo e `mock` são dados legados, não iniciam DEMO nem captura; `mock` é mostrado como legado indisponível no seletor. `pt-BR+en-US` migra para `pt-BR`, igual ao comportamento efetivo anterior; não se declara suporte bilíngue. O novo provedor/modelo padrão não habilita sugestões.
- Envelope de settings IPC permanece v1 (mesmas operações e metadados), com payload de preferências explicitamente versionado v2. Main e preload usam o mesmo parser estrito. Payload v1 recebido via IPC é recusado, inclusive resposta de binário antigo; migração é exclusiva do disco. A versão de sessão permanece v6 e sua autorização explícita não muda.
- Preferências salvas durante uma sessão afetam somente o próximo início. A sessão atual mantém idioma, modelo, limite, histórico e cartões. Não persistimos consentimento, limite, texto ou chave nas preferências/localStorage.

## Alternativas e consequências

Uma segunda BrowserWindow acrescentaria lifecycle e autorização IPC desnecessários. Desmontar o painel arriscaria perder estado local; mantê-lo oculto preserva o polling e o retorno imediato. O renderer recebe a resposta canônica do save para atualizar o próximo idioma; a confirmação relê o modelo e metadados da chave.

Manter modelo no diálogo criaria duas fontes de configuração. Migrar na borda IPC aceitaria clientes antigos silenciosamente; foi rejeitado. Não há downgrade para binários que só conhecem v1. Falhas de acesso ao arquivo são reportadas como indisponibilidade; nada é restaurado silenciosamente por defaults.

## Validação

Testes de contrato/preload recusam payloads antigos, campos extras, modelos desconhecidos e consentimentos persistidos. Testes de disco cobrem migração, releitura, conteúdo inválido e permissões. RTL e Electron offline cobrem navegação/foco, persistência com reinício, sessão em andamento/pausada, consentimento renovado e fluxo seguro da chave. Resultados e limites em [TEST-T042.md](../TEST-T042.md).
