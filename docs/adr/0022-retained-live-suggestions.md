# ADR 0022 — Retenção dos cartões reais durante a sessão

Data: 2026-11-12. Escopo: T040.

**Status:** decisões de capacidade e apresentação foram substituídas pela [ADR 0026](0026-all-live-suggestion-cards.md). Retenção sem TTL, deduplicação, descarte explícito e limpeza pelo ciclo de vida continuam válidos.

## Contexto

O fluxo real contínuo (ADR 0021) preservava cartões após novas falas, mas o TTL de 30 segundos ainda os removia durante a leitura. T040 exige permanência sem expiração arbitrária, descarte explícito, capacidade e memória limitadas, sem alterar a DEMO.

## Decisão

- `MeetingSuggestions` configura `SuggestionScheduler` com `ttlMs: null`. `SuggestionStore` representa isso como `expiresAt: null`; relógio e silêncio não removem cartões. O prazo de resposta do provider (15 s), debounce, cooldown, consentimento e orçamento permanecem independentes e inalterados.
- Preservar capacidade de **dois cartões**, ordenados por chegada. Cada inserção aceita substitui o mais antigo quando cheio. Não há fila oculta; descartar não traz cartões anteriores de volta. T041 poderá definir capacidade pela área disponível em sua própria sessão, sem mudanças de layout nesta tarefa.
- Deduplicar ID/corpo normalizado (NFKC, caixa e espaços) nas últimas **100 inserções aceitas**, incluindo descartados/substituídos. Sem TTL no fluxo real. Duplicatas não mudam a ordem. Ao ultrapassar 100, um conteúdo antigo pode ser aceito novamente; evita memória crescente. Limites de título (80), corpo (300), ID (80) e lote/snapshot (2) continuam validados nas fronteiras. Não há persistência, logs novos ou envio provocado por retenção/descarte.
- **Pausa limpa cartões e supressão**, aborta trabalho e limpa o corpo do último pedido, mantendo a política de privacidade anterior. Retomada não restaura cartões, não repete pedido automaticamente e não renova orçamento. Pode gerar novamente o mesmo conteúdo diante de uma nova fala final autorizada. Stop, revogação, restart, reload/fechamento limpam os dados conforme lifecycle existente; falhas/encerramento da transcrição continuam invalidando cartões. IDs crescentes e descarte de respostas canceladas impedem restauração por eventos atrasados.
- IPC de sessão passa **v5 → v6**. O parser de sugestões reais exige `expiresAt: null`; o da DEMO continua exigindo prazo numérico inteiro seguro. Snapshots desativados rejeitam cartões e orçamento remanescentes. Campo ausente, infinito, string, propriedades extras, duplicatas e capacidade excedida são rejeitados. Main/preload/renderer e fixtures migram juntos. v5 é rejeitada; status/configurações e JSONL Swift permanecem v1. Sem estado persistido a migrar.
- DEMO continua usando o store com TTL padrão de 30 s, inclusive em pausa. O scheduler isolado preserva seu default temporal para os testes/consumidores anteriores; apenas a integração real opta por retenção sem prazo. UI e diagnóstico explicam a política real e os motivos de limpeza.

## Alternativas e consequências

Aumentar o TTL continuaria causando desaparecimento por tempo. Histórico ilimitado ou dedup de toda a sessão sem limite aumentaria memória; arquivamento em disco mudaria a política de privacidade. Preservar cartões na pausa exigiria separar autorização de geração e visibilidade, além de mudar a limpeza existente; optou-se por mantê-la explícita e testada.

Cartões podem permanecer pouco relevantes até serem descartados, substituídos ou limpos; não há inferência semântica de validade. Não se afirma melhoria de qualidade da IA, validação em reunião real ou visibilidade em Spaces/tela cheia. Testes e limites em [T040.md](../evidence/tasks/T040.md).
