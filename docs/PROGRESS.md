# Estado atual e handoff

**Atualizado:** 2026-11-11. **Marco:** M3 — contexto, provider e gatilhos de sugestões.

## Snapshot

- T001–T015 e T017–T022 estão concluídas; T016 e T036–T039 estão `DEFERRED`. Estados e critérios completos ficam em [TASKS.md](TASKS.md).
- Apple Local usa helper Swift próprio integrado ao Electron e já exibe transcrição real no overlay.
- T019 encerrada com confirmação de validação pelo usuário (D018), gates automatizados e limites registrados em [TEST-T019.md](TEST-T019.md).
- Provider OpenAI e contexto limitado existem; integração real ao ciclo de sessão fica em T024. DEMO permanece offline; STT remoto segue adiado.
- T022 entrega TriggerEngine puro com cinco resultados e heurísticas pt-BR em falas finais. 77 testes novos e `verify` aprovados; avaliação sintética, sem captura/API. Evidências e limites em [TEST-T022.md](TEST-T022.md).

## Próximo trabalho

T023 é a próxima tarefa elegível, somente em nova sessão: dedup, debounce, cooldown, expiração e invalidação. T022 está concluída. O classificador recebe eventos novos já validados; não guarda histórico nem suprime repetições. Comando manual não concede consentimento nem ignora orçamento. Conexão ao ciclo real continua em T024.

O risco estático de lifecycle quit/reload continua aberto em O008 para T024/T032. O aceite T019 não demonstra correção nem ensaio específico de processos residuais; não há reprodução confirmada de helper órfão.

## Ambiente e referências

- Usar Node >=26; nesta sessão, `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify` passou. O Node 20 padrão do shell falha nos workers de testes.
- Gates Swift requerem acesso aos caches do compilador; repetição com escalada autorizada passou.
- Decisões vigentes e questões abertas: [DECISIONS.md](DECISIONS.md).
- Evidências T019: [TEST-T019.md](TEST-T019.md). Aceites anteriores: tarefas e documentos vinculados em [TASKS.md](TASKS.md).

Este arquivo mantém somente snapshot, próximo passo e limites relevantes; resultados detalhados ficam na evidência correspondente.
