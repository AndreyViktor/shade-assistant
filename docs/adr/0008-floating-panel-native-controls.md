# ADR 0008 — Painel compacto com controles nativos

Data: 2026-11-04. Tarefa: T007. Estado: aceito.

## Contexto e decisão

O painel precisa permanecer disponível durante o uso de outras janelas, com minimização, atalhos e acesso por teclado. Usamos BrowserWindow com `alwaysOnTop`, 440 × 640 e mínimo de 360 × 400, preservando barra de título, arraste, redimensionamento e botões nativos. Isso evita implementar controles de janela no renderer ou ampliar o IPC.

Menu instalado no main: minimizar (⌘M no Mac), mostrar (⇧⌘M), edição e zoom. Atalhos são locais ao app; o Dock/activate também restaura ou recria o painel. Aberturas simultâneas compartilham a criação em andamento. React controla apenas a seção de preferências, recolhida inicialmente, preservando rascunhos e devolvendo o foco ao fechar por Esc ou botão. Sem alteração de contratos, dependências, captura ou políticas de rede.

## Alternativas e consequências

Janela sem moldura exigiria recriar ações e arraste acessíveis; atalhos globais adicionariam conflitos e tratamento de registro sem necessidade para esta fatia. A moldura nativa ocupa espaço, mas fornece controles conhecidos do sistema. A janela flutuante não garante presença em todos os Spaces/fullscreen nem proteção contra captura (T030).

Testes unitários cobrem abertura/restauração, concorrência, falha e foco da seção. Smoke Electron real verifica tamanho, estado flutuante, ações do menu, accelerators registrados, teclado do renderer, zoom e reabertura. CDP/`sendInputEvent` enviam teclas à página e não acionaram os key equivalents Cocoa no ensaio; o smoke despacha os handlers reais do menu, sem permissões de automação do sistema. Teste físico de teclas nativas e VoiceOver não realizado.

Referências consultadas: [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [MenuItem](https://www.electronjs.org/docs/latest/api/menu-item) e [menus nativos](https://www.electronjs.org/docs/latest/tutorial/menus).
