# ADR 0028 — Perfis internos reutilizáveis de reunião

Data: 2026-11-23. Escopo: T061.

## Contexto

O contexto livre da T053 orienta relevância por sessão, mas não oferece focos reutilizáveis e previsíveis. A T061 pede descoberta, status, entrevista, negociação e revisão técnica, preservando o modo sem perfil e sem transformar uma preferência em evidência da conversa ou em nova retenção de conteúdo sensível.

## Decisão

- Um catálogo único e fechado define os cinco perfis, cada um com identificador, rótulo, objetivo e prioridades explícitos. `none` continua sendo o padrão. Não há perfil customizado nem texto livre persistente; ampliar o catálogo exige código, revisão e testes.
- Preferências passam de v3 para **v4** e persistem somente `meetingProfile`, um identificador interno não sensível. Migrações v1–v3 escolhem `none`. Objetivos e prioridades vêm do catálogo do aplicativo e não são gravados no arquivo. O contexto livre da T053 continua apenas em memória.
- O perfil salvo é só o padrão reutilizável. No diálogo de início, o usuário pode escolher outro perfil para aquela sessão. Sugestões continuam desmarcadas inicialmente; selecionar um perfil não concede consentimento, não inicia captura, não envia texto e não gera custo.
- IPC de sessão passa de v9 para **v10**. A autorização aceita opcionalmente um dos cinco identificadores focados e rejeita `none`, valores arbitrários, campos extras e perfis sem consentimento de contexto. Ausência do campo representa o modo sem perfil. JSONL Swift e IPC de configurações/status não mudam.
- `MeetingSuggestions` mantém o identificador somente durante a autorização ativa e o limpa em stop/revogação. Pausa preserva o perfil da mesma sessão. O provider resolve o catálogo e envia `meetingProfile: {id, objective, priorities}` no JSON de entrada, separado de `recent`, `summary`, `userContext` e `existingResults`, sob o mesmo `store: false`, orçamento e checagens de autorização existentes.
- O prompt permite usar perfil e contexto livre apenas para priorizar ajuda. Nenhum dos dois é evidência do que foi dito, decidido, prometido ou atribuído; resultados estruturados continuam exigindo referências válidas a segmentos finais. Um perfil não obriga cartão e não autoriza inventar fatos.
- A limpeza remove o perfil do estado de execução e do diagnóstico ao desativar/parar. O identificador padrão permanece intencionalmente nas preferências até o usuário salvar outro, inclusive `none`; isso é configuração, não conteúdo da reunião.

## Alternativas e limites

Perfis customizados persistidos foram descartados porque reintroduziriam conteúdo potencialmente sensível e exigiriam política própria de edição, retenção e limpeza. Duplicar objetivo/prioridades nas preferências permitiria deriva do catálogo. Inserir o perfil nas instruções de sistema elevaria uma preferência a regra; por isso ele permanece dado separado e não confiável.

Fixtures sintéticas cobrem o mapeamento entre cada perfil e seu foco, o payload, o modo sem perfil, troca de sessão e limpeza. Elas comprovam o mecanismo de priorização, não a qualidade semântica universal de um modelo real. Nenhuma chamada paga é necessária. Evidências em [T061.md](../evidence/tasks/T061.md).
