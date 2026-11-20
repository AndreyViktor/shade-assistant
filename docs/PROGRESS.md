# Estado atual e handoff

**Atualizado:** 2026-11-19. **Marco:** M10 — T027 BLOCKED.

## Resultado T027

- O corpus pt-BR sintético cobre 8 cenários/10 pontos; o avaliador offline exige cobertura idêntica e agrega qualidade, abstenção, evidência, repetição, latência, tokens e custo sem aceitar texto de transcrição/cartão no resultado.
- Dois controles inventados validaram todas as métricas, mas não representam modelos nem qualidade real. Não houve rede, credencial, OpenAI ou custo.
- Gates: 4 testes focados; `verify` com 908 TS aprovados (18 skipped), 19 runner, lint/formato/tipos/build. Protocolo, rubrica e limites em [T027.md](evidence/tasks/T027.md).

## Bloqueio e próximo passo

- O aceite exige comparar modelos reais no mesmo corpus. É necessária autorização humana explícita e limitada para modelos, rede, chave e teto de custo; depois, confirmar preços/disponibilidade atuais, executar os mesmos 10 pontos, rotular sem revelar a configuração e registrar somente artefatos sanitizados. Até lá T027 permanece `BLOCKED`; não iniciar outra tarefa nesta sessão.
