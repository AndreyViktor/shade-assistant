# ADR 0012 — Protocolo JSONL nativo v1 e TranscriptionProvider

**Data:** 2026-11-04. **Estado:** aceito para T012.

## Contexto

O helper Swift próprio e o Electron precisam compartilhar mensagens verificáveis, sem importar o formato exploratório da POC T006. T012 define o contrato e os codecs; captura/helper de produção, spawn, IPC de transcrição e reconciliação de falas pertencem a T013/T014/T017/T018.

## Decisão

`src/contracts/native` define tipos, validação, encoder de comandos, decoder incremental de eventos e ordenação de transporte. `core/transcription/TranscriptionProvider.ts` define a interface independente de SO/UI. O target Swift `MeetingCopilotProtocol` contém encoder de eventos e decoder incremental de comandos, sem depender de Speech, captura ou Electron. Os executáveis T005/T006 continuam independentes.

### Transporte e limites

- stdin recebe comandos; stdout contém somente eventos. UTF-8 estrito sem BOM, um objeto JSON por linha terminada em LF; CRLF aceito. Quebras dentro de texto são escapes JSON. Linhas vazias, JSON inválido, bytes UTF-8 inválidos e campos ausentes/extras são erros. Ordem das propriedades é irrelevante; os encoders emitem chaves únicas.
- Limite de **16.384 bytes antes de LF**, incluindo eventual CR e whitespace. Buffers parciais são limitados, inclusive sem newline. Tamanho textual máximo: **4.096 unidades UTF-16**, igual em JS/Swift; emoji ocupa duas. Os dois limites são independentes, inclusive após escapes JSON.
- Texto deve conter algum caractere fora do conjunto de whitespace de `String.trim` do JS. Swift usa o mesmo conjunto explícito; não usa a classificação diferente de Foundation. Surrogates UTF-16 isolados são rejeitados no JS; Strings Swift contêm Unicode válido. Conteúdo válido é preservado, sem trim, interpretação HTML ou alteração silenciosa. O consumidor deve exibir como texto, nunca como HTML ou log de diagnóstico.
- Qualquer falha fecha o decoder definitivamente e limpa seu buffer parcial. O lote da chamada que falhou não é entregue; lotes anteriores já recebidos continuam válidos. Novo processo/sessão exige novo decoder. Memória dos lotes depende do chunk fornecido; filas/backpressure do subprocesso serão limitadas em T013/T014. Limpar buffer não é garantia de apagamento criptográfico de cópias do runtime.
- EOF com bytes pendentes é truncamento, mesmo se o objeto JSON parece completo. EOF de stdout exige `stopped` para **todas** as fontes selecionadas; caso contrário é stream incompleto. EOF limpo de stdin encerra o framing; T013 deverá parar captura/liberar recursos mesmo sem comando `stop`. O decoder não executa lifecycle nem acessa áudio.

### Comandos

Envelope obrigatório: `{version:1, sessionId, type}`. IDs de sessão/segmento: 1–64 caracteres ASCII `[A-Za-z0-9_-]`. O main cria ID novo por sessão; não usa fala/chaves como ID.

| type     | Campos adicionais obrigatórios | Semântica do futuro helper                                                                          |
| -------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `start`  | `sources`, `locale`            | Uma sessão por instância; uma ou duas fontes distintas `mic`/`system`; um locale `pt-BR` ou `en-US` |
| `pause`  | Nenhum                         | Parar captura de todas as fontes da sessão ativa                                                    |
| `resume` | Nenhum                         | Retomar a mesma sessão; conservar relógio e sequências                                              |
| `stop`   | Nenhum                         | Cancelar e liberar todas as fontes, inclusive durante startup                                       |

Não existem flags livres, caminho de executável, chave, prompt ou parâmetro de rede. Suporte sintático a en-US não comprova assets/qualidade; PT+EN simultâneo não faz parte do v1. T013 deve validar a sessão e as transições dos comandos; esta tarefa valida seus schemas/framing.

### Eventos

Envelope obrigatório em todos: `{version:1,sessionId,source,locale,seq,timestampMs,type}`. `source` e `locale` precisam corresponder à configuração. Todos os números são inteiros seguros JS (0 a 9.007.199.254.740.991), com `seq >= 1`.

| type                | Campos adicionais obrigatórios            |
| ------------------- | ----------------------------------------- |
| `ready`             | `supportsPartial: boolean`                |
| `status`            | `state: listening \| paused`              |
| `partial` / `final` | `segmentId`, `startMs`, `endMs`, `text`   |
| `error`             | `code` da allowlist                       |
| `stopped`           | `reason: completed \| cancelled \| error` |

`timestampMs` é tempo monotônico decorrido desde uma origem comum da sessão no helper, não epoch/data civil. Pausa não reinicia o relógio. `startMs <= endMs <= timestampMs`, na mesma origem. `seq` começa em 1 por `(sessionId, source)` e aumenta exatamente em 1 **para todo evento**, inclusive status/erro. O timestamp não retrocede dentro da fonte; igualdade é permitida. Interleaving de fontes não impõe ordem global de timestamps. Lacunas/duplicatas, outra sessão, fonte não selecionada ou locale divergente encerram o decoder.

Por fonte: `ready → listening → (partial/final)*`; `listening → paused → listening` pode repetir. Parciais só são aceitos se `ready.supportsPartial=true`. Um final não exige parcial anterior nem igualdade das faixas temporais. `error` pode ocorrer inclusive antes de ready e admite somente `stopped/error` depois. `stopped/cancelled` pode ocorrer durante startup sem inventar ready; `stopped/completed` exige inicialização. `stopped` é terminal. Segmentos/revisões, eco, ordenação de apresentação entre fontes e políticas de eventos tardios de pausa serão tratados nas integrações/T018.

Erros nativos são somente `permission-denied`, `unavailable`, `unsupported-locale`, `assets-unavailable`, `capture-failed`, `transcription-failed`, `invalid-command`, `internal`. Sem campo livre `message`, stack ou payload. Falhas locais de validação/framing usam `NativeProtocolError` no TS e `NativeProtocolFailure` no Swift; as entradas públicas de linha/stream redigem erros JSON/Foundation. Não registrar dados brutos nem causas. stderr do futuro helper também deve usar diagnósticos fixos sem falas/chaves.

### Interface do provider

`start(config,onEvent,signal)`, `pause()`, `resume()`, `stop()` retornam promises. Uma instância por sessão; autorização explícita verificada pelo main antes de start. Start resolve após todas as fontes estarem prontas/escutando, abort deve liberar recursos inclusive durante inicialização. Pause resolve quando a captura parou e impede novas callbacks de transcrição até resume; resume conserva sequências/relógio. Stop é idempotente, inclusive antes/durante start, resolve após cleanup/callbacks finais e não permite callbacks posteriores. Falhas de transporte devem ser códigos seguros. Essas são obrigações dos adapters futuros, não alegação de captura implementada por uma interface.

### Compatibilidade e validação

As fixtures únicas em `native/macos/Tests/MeetingCopilotProtocolTests/Fixtures` são consumidas por Swift Testing e `tests/integration/nativeProtocol.test.ts`. Swift compara sua serialização aos eventos que TS valida; TS compara seus comandos aos objetos que Swift decodifica. Também compartilham comandos inválidos, framing e casos Unicode/textuais. Testes locais adicionais cobrem todos os splits, chunks de um byte, limites exatos/overflow, truncamento/EOF, sessão/fonte/locale, estados inválidos e sanitização. Não é teste de subprocesso/captura real nem execução do parser dentro do Electron; isso pertence à T014. Ambos os gates devem passar no Mac quando o contrato mudar.

## Alternativas e consequências

Não reutilizar a saída de terminal da POC, IPC genérico ou protocolo externo de STT. JSONL mantém inspeção e implementação simples, com limites e erros explícitos. Schemas TS/Swift necessariamente duplicam estrutura entre linguagens; fixtures compartilhadas impedem divergência nas mensagens cobertas, sem introduzir gerador ou dependência adicional. Mudanças incompatíveis exigem nova versão e atualização dos dois runtimes/testes; não aceitar versão desconhecida silenciosamente. A integração posterior deverá usar estes codecs e testar cleanup, timeouts e backpressure no processo real.
