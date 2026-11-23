# Estado atual e handoff

**Atualizado:** 2026-11-23. **Marco:** M10 — T060 BLOCKED.

## Plano T060

- Objetivo/aceite: exibir tópico atual, decisões, ações, perguntas e riscos durante a reunião, sempre ligados a falas/horários, distinguindo fato de inferência e sem inventar decisão, responsável ou prazo; validar ausência, contradição e revisão.
- Política antes da implementação: reutilizar consentimento, orçamento e chamada de contexto já autorizados; manter resultados somente em memória; aceitar apenas referências a segmentos finais do contexto enviado. Uma resposta substitui o tópico atual e aplica correção/remoção explícita por chave estável aos demais itens; contradição ou ausência sem suporte não vira fato. Limites pequenos e validação estrita serão registrados em ADR.
- Implementação: adicionar contrato/store determinístico; ampliar Structured Output/provider sem chamada extra; integrar lifecycle e IPC versionado; criar painel acessível com evidências e disclosure. Módulos: contratos de reunião/IPC, provider/prompt, `MeetingSuggestions`, store, hook/UI/estilos, testes, ADR e evidência T060.
- Testes/gates: contrato, store, provider, lifecycle, IPC e UI, incluindo conteúdo ausente, contraditório, revisado e inválido; testes focados, `npm run verify` e `git diff --check`.

## Recuperação/auditoria T060

- Esta sessão de recuperação preservou e auditou a implementação interrompida. Foram corrigidos somente os gaps encontrados: remoção exige grounding de reunião e fala posterior, o exemplo do prompt usa referência existente, o preload mantém a versão IPC literal e os e2e T060 distinguem resultados de cartões e percorrem os novos controles acessíveis.
- Gates offline: testes focados 179/179; `verify` com 924 Vitest aprovados, 19 skipped, 19 runner, lint/formato/tipos/build; `git diff --check` aprovado. Smoke Electron: 27/28; todos os fluxos T060 passaram.
- Bloqueio: `tests/e2e/panel.spec.ts`, não alterado pela tarefa, não obteve foco nativo no macOS desta sessão (`BrowserWindow.isFocused() === false`) nem isolado. Repetir o smoke em sessão gráfica que conceda foco; se 28/28, atualizar T060 para `DONE` e encerrar sem iniciar T061. Sem API paga, captura real, credenciais, push ou deploy.
