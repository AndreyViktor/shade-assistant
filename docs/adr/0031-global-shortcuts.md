# ADR 0031 — Atalhos globais restritos e consentimento existente

Data: 2026-11-24. T068.

## Contexto

A janela e os controles de uma sessão precisam funcionar sem foco no painel. Atalhos não podem observar teclas arbitrárias nem contornar o consentimento e o orçamento das sugestões.

## Decisão

O processo principal registra quatro atalhos globais com `globalShortcut` após o Electron estar pronto e os libera ao fechar a janela. A configuração é local, em arquivo privado versionado, validada no IPC dedicado v1 e confirmada antes de salvar ou restaurar padrões. A alteração tenta registrar todas as combinações; conflito ou erro rejeita a alteração e tenta restaurar o registro anterior. Como outro processo pode ocupar uma combinação durante a troca, a interface informa que a restauração pode falhar e permite nova tentativa.

As opções são limitadas a CommandOrControl+Alt+Shift com F1–F12, sem atalhos de caracteres ou captura de teclas para configurá-los. Enquanto um campo editável do próprio painel tem foco, o renderer sinaliza somente o estado de edição e o main libera os registros; ao sair, tenta registrá-los novamente. Fora do painel o app não inspeciona campos de outros aplicativos nem monitora digitação: a restrição a teclas de função evita interceptar caracteres comuns, mas não garante ausência de conflito com comandos de outros aplicativos. O SO pode recusar registros e a interface comunica a indisponibilidade.

Pausar, retomar e parar reutilizam a lógica da sessão no main. Ajuda manual alimenta o mesmo agendador e contexto final, sujeito a sessão ativa, consentimento vigente e orçamento; não inicia captura nem concede autorização. Mostrar/ocultar controla a janela nativa, sem garantia sobre compartilhamento ou gravação.

## Alternativas e consequências

Capturar uma combinação digitada ou observar edição em outros aplicativos ampliaria o acesso a entrada e poderia exigir permissões adicionais; não é necessário para as opções restritas desta entrega. A seleção é menos livre, e um atalho de outro aplicativo não registrado globalmente ainda pode disputar a mesma combinação. Nenhuma permissão de Acessibilidade é solicitada. Ao fechar a janela os atalhos deixam de funcionar até ela ser recriada; falhas no registro são explícitas e não alteram autorizações da sessão.
