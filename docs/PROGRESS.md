# Estado atual e handoff

**Atualizado:** 2026-11-06. **Marco:** M3 — contexto e provider de sugestões.

## Snapshot

- T001–T015, T017–T018 e T020–T021 estão concluídas; T016 e T036–T039 estão `DEFERRED`. Estados e critérios completos ficam somente em [TASKS.md](TASKS.md).
- Apple Local usa helper Swift próprio integrado ao Electron e já exibe transcrição real no overlay, conforme aceites registrados nas tarefas e [TEST-T017.md](TEST-T017.md).
- O provider OpenAI de sugestões e o contexto limitado existem, mas a integração real ao ciclo de sessão ainda é futura (T024). DEMO permanece offline; STT remoto segue adiado.

## Próximo trabalho

T019 é a próxima tarefa elegível. Revisar robustez do lifecycle Apple Local reaproveitando evidências existentes; não reimplementar controles já entregues.

Risco de lifecycle identificado por inspeção estática, ainda sem reprodução: reload/fechamento chama `stopSession()` sem aguardar, e o quit não coordena a saída do app com a limpeza. Verificar se novo início pode coincidir com o encerramento do helper e se a captura/processo realmente param. Isso não comprova helper órfão nem sobreposição. Escopo e aceite estão em [TASKS.md](TASKS.md).

## Onde buscar detalhes

- Decisões vigentes: [DECISIONS.md](DECISIONS.md) e ADRs vinculados pela tarefa.
- Estado e evidências por tarefa: [TASKS.md](TASKS.md).
- Ensaios de produto: [TEST-T017.md](TEST-T017.md), [TEST-T018.md](TEST-T018.md), [T005-SWIFT-CAPABILITIES.md](T005-SWIFT-CAPABILITIES.md) e [T006-SWIFT-AUDIO-POC.md](T006-SWIFT-AUDIO-POC.md).
- Histórico de execução: [PROGRESS-HISTORY.md](PROGRESS-HISTORY.md), somente quando necessário.

Este arquivo é um handoff curto, não um log de sessão. Registre aqui apenas o snapshot atual, o próximo passo e bloqueios relevantes; mantenha resultados duráveis na tarefa ou evidência correspondente.
