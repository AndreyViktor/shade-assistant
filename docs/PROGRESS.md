# Estado atual e handoff

**Atualizado:** 2026-11-11. **Marco:** M3 — contexto e provider de sugestões.

## Snapshot

- T001–T015 e T017–T021 estão concluídas; T016 e T036–T039 estão `DEFERRED`. Estados e critérios completos ficam em [TASKS.md](TASKS.md).
- Apple Local usa helper Swift próprio integrado ao Electron e já exibe transcrição real no overlay.
- T019 encerrada com confirmação de validação pelo usuário (D018), gates automatizados e limites registrados em [TEST-T019.md](TEST-T019.md). Nenhuma alteração de implementação nesta sessão.
- Provider OpenAI e contexto limitado existem; integração real ao ciclo de sessão fica em T024. DEMO permanece offline; STT remoto segue adiado.

## Próximo trabalho

T022 é a próxima tarefa elegível: TriggerEngine para pergunta/objeção/compromisso/manual/none, com testes sintéticos incluindo silêncio deliberado. T021, seu pré-requisito, está concluída. Iniciar em nova sessão conforme o fluxo de uma tarefa por sessão.

O risco estático de lifecycle quit/reload continua aberto em O008 para T024/T032. O aceite T019 não demonstra correção nem ensaio específico de processos residuais; não há reprodução confirmada de helper órfão.

## Ambiente e referências

- Usar Node >=26; nesta sessão, `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify` passou. O Node 20 padrão do shell falha nos workers de testes.
- Gates Swift requerem acesso aos caches do compilador; repetição com escalada autorizada passou.
- Decisões vigentes e questões abertas: [DECISIONS.md](DECISIONS.md).
- Evidências T019: [TEST-T019.md](TEST-T019.md). Aceites anteriores: tarefas e documentos vinculados em [TASKS.md](TASKS.md).

Este arquivo mantém somente snapshot, próximo passo e limites relevantes; resultados detalhados ficam na evidência correspondente.
