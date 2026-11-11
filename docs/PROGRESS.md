# Estado atual e handoff

**Atualizado:** 2026-11-11. **Marco:** M3 — contexto, provider e gatilhos de sugestões.

## Snapshot

- T001–T015 e T017–T023 estão concluídas; T016 e T036–T039 estão `DEFERRED`. Estados e critérios completos ficam em [TASKS.md](TASKS.md).
- Apple Local usa helper Swift próprio integrado ao Electron e já exibe transcrição real no overlay.
- T019 encerrada com confirmação de validação pelo usuário (D018), gates automatizados e limites registrados em [TEST-T019.md](TEST-T019.md).
- Provider OpenAI e contexto limitado existem; integração real ao ciclo de sessão fica em T024. DEMO permanece offline; STT remoto segue adiado.
- T023 acrescenta scheduler com debounce/cooldown, manual sujeito à autorização, execução serial e descarte por revisão/sessão/prazo. Dedup/expiração permanecem no store. 28 testes novos e `verify` aprovados; evidências offline em [TEST-T023.md](TEST-T023.md), política no [ADR 0018](adr/0018-suggestion-scheduling.md).

## Próximo trabalho

T023 encerrada; T024 é elegível somente em nova sessão. Integrar áudio → STT → contexto → provider → overlay, respeitando autorização humana para captura/envio/custos. O host deve reutilizar o scheduler, fornecer contexto validado/limitado e revisão monotônica por nova informação final, conectar AbortSignal a pausa/stop/revogação, fornecer autorização efetiva e consultar snapshots para expiração visual. Manual não concede consentimento nem ignora orçamento.

Limites: nova revisão invalida cartões conservadoramente, sem classificar tópicos semanticamente; provider que ignora abort ocupa a vaga até terminar, sem chamadas sobrepostas. Defaults precisam de avaliação real. Nenhuma conexão real de sugestões foi ativada nesta sessão.

O risco estático de lifecycle quit/reload continua aberto em O008 para T024/T032. O aceite T019 não demonstra correção nem ensaio específico de processos residuais; não há reprodução confirmada de helper órfão.

## Ambiente e referências

- Usar Node >=26; nesta sessão, `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify` passou. O Node 20 padrão do shell falha nos workers de testes.
- T023 não altera Swift/main/renderer/IPC; sem captura, credenciais ou chamadas pagas. Gates Swift, quando aplicáveis, requerem acesso autorizado aos caches do compilador.
- Decisões vigentes e questões abertas: [DECISIONS.md](DECISIONS.md).
- Evidências T019: [TEST-T019.md](TEST-T019.md). Aceites anteriores: tarefas e documentos vinculados em [TASKS.md](TASKS.md).

Este arquivo mantém somente snapshot, próximo passo e limites relevantes; resultados detalhados ficam na evidência correspondente.
