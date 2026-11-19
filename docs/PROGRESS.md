# Estado atual e handoff

**Atualizado:** 2026-11-19. **Marco:** M10 — T057 DONE.

## Resultado T057

- O novo `MeetingCopilotSTTEvaluator` mede WER, tipos de erro, formato e timing sobre mídia local, com saída sem texto por padrão. Três referências sintéticas geram AIFF, WAV 16 kHz e M4A/ALAC fora do Git; vídeo `.mov` também foi validado no Mac.
- Os presets de produção e qualidade tiveram WER 0 no mesmo corpus. O segundo não melhorou acurácia e não fornece parciais; o preset de produção foi mantido, sem alegação de ganho.
- A captura física somente de áudio do sistema obteve 19 parciais, 1 final e WER 0; `mic=0`, `STOPPED_CAPTURE_OFF`, sem reunião, rede ou OpenAI. Arquivo/vídeo/captura não mostraram perda no caso controlado.
- Gates: 7 testes focados; `verify:swift` com 57 testes e release; `verify` com Node 26, 904 TS aprovados (18 skipped), 19 runner, lint/formato/tipos/build; `git diff --check` aprovado. Evidências em [T057.md](evidence/tasks/T057.md).

## Handoff e limites

- O corpus curto usa uma voz sintética e não generaliza para fala humana, ruído, sotaques ou sobreposição; timing de arquivo não é latência ao vivo. O fallback de extração compilou, mas o `.mov` testado abriu diretamente.
- Encerrar após o commit local T057. T027 pode usar este avaliador numa sessão futura separada; não foi iniciada.
