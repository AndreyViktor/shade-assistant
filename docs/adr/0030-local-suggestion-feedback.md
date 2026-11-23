# ADR 0030 — Feedback local e anônimo das sugestões

Data: 2026-11-23. Escopo: T064.

## Contexto

Avaliar utilidade ajuda a revisar a qualidade das sugestões, mas fala, contexto e conteúdo dos cartões são dados da reunião. Enviar avaliações automaticamente ou persistir esses dados criaria uma nova fronteira de privacidade sem necessidade para a métrica inicial. Um mesmo cartão também pode receber cliques repetidos ou ter sua classificação corrigida, sem que isso infle as contagens.

## Decisão

- Cada cartão real visível pode ter exatamente uma classificação local: `useful`, `irrelevant`, `incorrect` ou `repeated`. Repetir a mesma escolha é idempotente; escolher outra substitui a anterior. IDs inexistentes ou cartões já removidos não criam avaliação.
- O estado fica somente na memória do processo principal. O snapshot IPC v11 entrega ao renderer o ID técnico e a classificação necessários para mostrar o estado do controle, além dos totais agregados. Não há persistência em preferências, cofre, logs ou armazenamento do renderer.
- Pausar, descartar cartão, revogar sugestões e parar preservam temporariamente as métricas para revisão após a reunião. Limpeza explícita, início aceito de outra sessão, reload/fechamento do app ou fim do processo removem os dados. O conteúdo dos cartões continua seguindo seu ciclo próprio e não é copiado para o store de feedback.
- O diagnóstico mostra somente a quantidade avaliada. O export é opcional e ocorre apenas após ação explícita e escolha de destino no diálogo nativo. O JSON contém versão de schema, horário da exportação e contagens agregadas; exclui ID de sessão/cartão, fala, contexto, modelo, título, corpo, chave e comentários livres. O arquivo é escrito com o mecanismo privado local e nenhuma exportação implica upload.
- Os controles usam `fieldset`/`legend` e botões nativos com `aria-pressed`, mantendo navegação e ativação por teclado sem capturar teclas globalmente. DEMO não aceita avaliação.
- O contrato IPC passa de v10 para **v11**, com ações estritas para avaliar, limpar e exportar. Nenhuma ação contém texto livre; valores extras e classificações fora da allowlist são rejeitados.

## Alternativas e consequências

Persistir avaliações entre execuções foi rejeitado porque não é necessário para métricas por sessão e ampliaria retenção e migração. Exportar avaliações por cartão, modelo ou categoria foi rejeitado nesta etapa para reduzir reidentificação; a análise começa por totais anônimos. Enviar feedback à OpenAI ou a telemetria própria fica fora do escopo e exigiria novo consentimento/decisão.

Preservar o resumo após parar permite exportação pós-reunião, mas ele existe somente até o próximo ciclo ou fechamento. A correção de classificação altera os totais anteriores em vez de criar histórico. Evidências em [T064.md](../evidence/tasks/T064.md).
