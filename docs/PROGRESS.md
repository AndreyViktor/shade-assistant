# Estado atual e handoff

**Atualizado:** 2026-11-19. **Marco:** M10 — T056 DONE.

## Resultado T056

- A política conservadora compartilhada suprime finais prováveis de eco nos snapshots do overlay e do contexto IA, tolerando até 1,5 s nas bordas, sobreposição temporal forte e pequenas diferenças de palavras; falas curtas, textualmente distintas ou temporalmente afastadas permanecem.
- Replay sintético pt-BR/en-US cobre desvio temporal/textual, ordem de chegada e fala simultânea distinta. O helper agora solicita tap de 200 ms e falha antes de `AVAudioEngine` quando o HAL não possui input padrão, evitando o `SIGABRT` observado.
- Após o reinício restaurar o input, o teste físico autorizado gerou um final de 12 palavras por fonte nos intervalos `660–8580 ms` e `850–8470 ms`; transcript local e contexto IA reduziram `2` finais brutos para `1`. O teste não imprime o texto reconhecido.
- Gates: 65 testes focados, 50 testes Swift + release e `npm run verify` com Node 26 aprovados (889 TS, 18 skipped; 19 runner). Nenhuma mudança de protocolo, API, rede ou custo.
- Evidências e limites: [T056.md](evidence/tasks/T056.md).

## Handoff

- T057 está desbloqueada e é a próxima tarefa da sequência protegida; não foi iniciada nesta sessão.
- A supressão é textual e conservadora, não AEC acústico. Uma execução física anterior com segmentação diferente produziu `3 → 3`; divergência textual/temporal ou segmentação incompatível continua sendo limite documentado.
- O gate deve usar `env PATH=/opt/homebrew/opt/node@26/bin:$PATH`; o Node padrão do ambiente falha ao iniciar workers `jsdom/undici`.
