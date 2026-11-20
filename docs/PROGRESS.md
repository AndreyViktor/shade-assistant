# Estado atual e handoff

**Atualizado:** 2026-11-19. **Marco:** M10 — T027 DONE.

## Resultado T027

- Comparação real pareada: 5 pontos por modelo, 10 chamadas totais, 3 cartões em `gpt-5.4-mini` e 3 em `gpt-5.4`. Custo combinado US$ 0,020108, dentro do teto de US$ 0,10.
- Ambos abstiveram nos fragmentos inicial/incerto, sugeriram no caso rotulado para abstenção e repetiram a intenção de atribuir responsável. O mini teve p50 1605 ms e primeiro cartão útil 1540 ms; o GPT-5.4 teve p50 2025 ms/2087 ms e grounding mais aderente (100% contra 33,33%).
- Respostas brutas existiram apenas em temporário privado e foram removidas; Git guarda corpus/rótulos/tokens/tempos/custo, sem texto dos cartões nem chave. Evidências e limitações em [T027.md](evidence/tasks/T027.md).
- Gates: runner real aprovado; `verify` com 909 TS aprovados (19 skipped), 19 runner, lint/formato/tipos/build; `git diff --check` aprovado.

## Handoff e limites

- Amostra pequena, uma execução, rotulagem não cega e schema limitado a um cartão/ponto: baseline, não benchmark geral. Manter `gpt-5.4-mini` como padrão; T025 continua responsável por orçamento operacional.
- Encerrar após commit local T027. T060 pode começar somente em uma nova sessão; T061 continua dependente de T060. Não houve push.
