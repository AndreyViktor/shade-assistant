# Estado atual e handoff

**Atualizado:** 2026-11-24. **Marco:** T074 DONE.

## Resultado

- Usuário aprovou a proposta de Preferências no Figma e pediu a implementação. Links, critérios de navegação, estados e limites em [T074](evidence/tasks/T074.md).
- `npm run verify` passou com 985 testes Vitest e 19 do runner. A T065 está concluída para uso local. Os dois ensaios de TCC do pacote seguem na T034 conforme D022.
- A avaliação de uso do overlay não estava coberta por T075/T076; a simplificação aprovada foi registrada como T077, e T068 agora depende dela para tratar ocultação real da janela.

## Próximo passo

- Sequência escolhida para o runner: T076 e depois T075, em sessões separadas. A T076 usa as capturas do Product Design em [T074](evidence/tasks/T074.md#preferências-t076).
- Na T076, manter o perfil padrão na área de sugestões. A T075 vai mover a escolha de foco para o início de cada sessão com sugestões e tratar a migração. T077 segue como tarefa independente.
