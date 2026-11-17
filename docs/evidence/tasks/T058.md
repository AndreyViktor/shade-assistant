# T058 — Esperar por contexto adicional antes de sugerir

**Data:** 2026-11-15  
**Status:** DONE; comportamento qualitativo do modelo real permanece em T027.

## Causa

O `ContextManager` já mantinha várias falas finais recentes e resumo. Porém, no modo contínuo, o scheduler conservava o prazo da primeira fala final: após 500 ms, podia enviar esse snapshot mesmo que outros fragmentos tivessem acabado de chegar. Uma resposta vazia não encerrava a sessão de sugestões, mas isso não tinha teste integrado demonstrando nova avaliação com contexto maior.

## Alteração

- O debounce automático agora aguarda 2 s depois da fala final mais recente. Novos fragmentos substituem o contexto pendente e reiniciam essa janela.
- A chamada manual continua imediata. Cooldown de 10 s, autorização, orçamento, execução serial e cancelamento permanecem.
- O prompt orienta retornar zero cartões se o contexto estiver fragmentado/duvidoso, deixando a aplicação avaliar transcrições futuras; um exemplo sintético reproduz o padrão de frase incerta perto de uma menção à agenda e retorna zero cartões.
- Uma resposta vazia não cria cartão. Uma nova fala final pode solicitar outra avaliação com as falas acumuladas, depois do cooldown.

## Evidências

- Testes focados de scheduler, contexto e provider: 109 passaram.
- Testes focados de IPC e replay de agendamento: 21 passaram.
- `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify`: 886 testes TS passaram, 18 skipped; 19 testes do runner passaram; lint, formato, tipos e build passaram.
- Fixtures e transporte sintéticos. Nenhuma chamada à API foi feita.

## Limites

- A janela de 2 s reduz a chance de avaliar fala ainda chegando, sem determinar semanticamente quando uma ideia terminou. Mais fala recebida após uma chamada gera avaliação posterior sujeita ao cooldown de 10 s.
- Os testes comprovam acúmulo/contexto e agendamento, não que um modelo real sempre obedecerá às instruções nem que as sugestões terão alta relevância. O exemplo de cartão reportado pelo usuário reforça a necessidade de avaliação humana em T027.
- Duplicidade acústica entre áudio do sistema e microfone segue na T056; avaliação do SpeechAnalyzer em vídeos segue na T057.
