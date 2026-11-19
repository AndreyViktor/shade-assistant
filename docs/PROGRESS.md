# Estado atual e handoff

**Atualizado:** 2026-11-19. **Marco:** M10 — T056 BLOCKED.

## Resultado parcial T056

- A política conservadora compartilhada suprime finais prováveis de eco nos snapshots do overlay e do contexto IA, tolerando até 1,5 s nas bordas, sobreposição temporal forte e pequenas diferenças de palavras; falas curtas, textualmente distintas ou temporalmente afastadas permanecem.
- Replay sintético pt-BR/en-US cobre desvio temporal/textual, ordem de chegada e fala simultânea distinta. O helper agora solicita tap de 200 ms e falha antes de `AVAudioEngine` quando o HAL não possui input padrão, evitando o `SIGABRT` observado.
- O teste manual agora toca uma frase sintética via `/usr/bin/say`, exige finais de mic/system e compara apenas contagens reconciliadas, sem imprimir texto reconhecido.
- Gates: 65 testes focados, 50 testes Swift + release e `npm run verify` aprovados (889 TS, 18 skipped; 19 runner). Nenhuma mudança de protocolo, API, rede ou custo.
- Evidências e limites: [T056.md](evidence/tasks/T056.md).

## Bloqueio e retomada

- Os relatórios macOS e o log unificado mostraram `input hw format invalid`, default input ID 0 e `SIGABRT` em `AVAudioNode.installTap`. `system_profiler SPAudioDataType` confirma que este Mac não expõe nenhum device de áudio. Após o guard HAL, o ensaio retorna `capture-failed` em vez de encerrar o processo; nenhuma frase foi tocada/capturada e não houve novo crash.
- Próximo passo: conectar um microfone, selecioná-lo em Ajustes do Sistema > Som > Entrada, manter as permissões do helper, usar alto-falantes audíveis e repetir `npm run test:native-capture`. Se passar, registrar as contagens/limites, marcar `DONE` e criar o commit local T056.
