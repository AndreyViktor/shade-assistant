# T017 — validação manual da transcrição no overlay

Objetivo: validar **nosso helper Swift → provider Electron → IPC → React** em Mac compatível. O teste sintético automatizado não substitui este ensaio.

1. No Terminal com as permissões já concedidas na T015, entre na raiz do projeto e execute `npm run dev` com Node 26. Não é necessário configurar chave OpenAI.
2. Selecione **Ambas as fontes** e **Português (Brasil)**. Clique em **Iniciar transcrição local** e confirme a captura da sessão. Se o macOS pedir permissão, a decisão é manual.
3. Fale uma frase sintética no microfone e reproduza uma fala sintética/conteúdo de teste no sistema. Confira que o painel **APPLE LOCAL (SWIFT)** apresenta texto reconhecido e rótulos **Microfone/Sistema**, `pt-BR` e **Final** (parciais somente se recebidas). Não usar uma reunião privada para o ensaio.
4. Clique em **Pausar**: a captura deve pausar e nenhuma fala nova deve surgir. Clique em **Retomar** e confira novas falas.
5. Clique em **Parar**: o painel de falas deve desaparecer. Inicie outra sessão: as falas anteriores não devem reaparecer. Pare ao terminar.
6. Opcionalmente recarregue a janela durante a captura: a sessão deve encerrar e o texto deve ser limpo.

Registre somente data, fontes/idioma, se cada etapa passou e eventual código/mensagem segura de erro. **Não copie texto reconhecido nem grave áudio/screenshot da reunião.** Em desenvolvimento unpackaged, TCC pertence ao processo responsável (Terminal/IDE); a identidade de distribuição permanece na T034.
