# Meeting Copilot

Assistente desktop de reuniões em tempo real, feito com Electron, React e TypeScript. O objetivo do MVP é executar localmente no macOS, com transcrição Apple implementada pelo projeto em Swift e sugestões de IA opcionais e autorizadas.

## Status

O app macOS tem demonstração offline, transcrição Apple Local e sugestões de IA opcionais. O overlay mostra falas recentes, resultados e cartões, com visualizações configuráveis e atalhos globais. O empacotamento para distribuição segue no [roadmap](docs/ROADMAP.md#próximas-tarefas). O fallback OpenAI STT (T016) e Windows (T036–T039) permanecem adiados.

## Executar

Requer Node.js **26.0.0** (`.nvmrc`) e npm. Com `nvm` instalado:

```bash
nvm use
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run dev
```

No macOS, `npm run dev` também compila o helper Swift dentro de um app nativo com descrições de uso do microfone e do áudio do sistema. A aplicação abre sem captura ativa, com Apple Local como ação principal e a DEMO offline em **Preferências → Diagnóstico**. Apple Local só solicita permissões após seleção do modo, consentimento explícito e início da sessão. A primeira autorização de gravação de tela/áudio pode exigir aprovação em Ajustes do Sistema e reabertura do Meeting Copilot. Para compilar e abrir o build:

```bash
npm run build
npm start
```

Instruções adicionais de instalação, testes e gates Swift estão em [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). O roteiro de demonstração está em [docs/DEMO.md](docs/DEMO.md). O ensaio real da transcrição no overlay está em [docs/evidence/tasks/T017.md](docs/evidence/tasks/T017.md).

## Preferências e início da sessão

Em **Preferências → Áudio e transcrição**, escolha a fonte, o idioma e o fornecedor. Em **Sugestões de IA**, escolha o fornecedor e o modelo e importe ou remova a chave OpenAI pelo fluxo seguro do Mac. Use **Salvar preferências** para aplicar essas escolhas à próxima sessão. Voltar com alterações pendentes pede confirmação para descartá-las. Em **Permissões e prontidão**, confira o estado antes de iniciar a captura.

Para iniciar, confirme a captura. Se habilitar **Adicionar sugestões de IA**, você pode escolher o **Foco do assistente**, que começa em **Sem perfil** a cada sessão. Revise o limite de pedidos e confirme o envio de texto e o custo da API para aquela reunião.

Preferências antigas válidas são migradas automaticamente. A opção bilíngue legada passa a pt-BR, e o perfil padrão legado é removido. Arquivos inválidos são preservados.

## Visualizações e atalhos do overlay

O painel **Sessão local** mostra o estado, a fonte de áudio e o idioma junto dos controles de início, pausa e parada. Na barra logo abaixo, escolha **Completa**, **Transcrição** ou **Assistência**, ou abra **Preferências**. A troca de visualização preserva a sessão em andamento.

Quando você autoriza sugestões, a assistência mostra primeiro os cartões mais recentes. Os resultados com suas falas de suporte ficam abaixo da lista. O rodapé indica o estado da captura e se o envio de texto à OpenAI está autorizado.

Em **Preferências → Atalhos globais**, configure ou restaure as combinações do macOS. Todos os atalhos padrão usam **⌘ + ⌥ + ⇧** com **F9** para mostrar ou ocultar a janela, **F10** para pausar ou retomar, **F11** para parar e **F12** para pedir ajuda. Confirme para aplicar a alteração. Os atalhos são suspensos enquanto um campo editável do painel está em foco, e o pedido manual respeita o consentimento e o limite da sessão.

## Chave OpenAI no desenvolvimento

Para sugestões de IA, copie `.env.example` para `.env` na raiz do projeto e preencha:

```dotenv
OPENAI_API_KEY=sua_chave_da_api
```

Reinicie com `npm run dev`. A chave é lida somente pelo processo principal; a interface mostra apenas se está configurada. O `.env` fica fora do Git, mas contém texto simples: não o compartilhe nem use prefixos `VITE_` para segredos. A transcrição local não precisa de chave. As sugestões continuam dependendo de autorização na sessão e usam a API paga separadamente do ChatGPT Plus.

Em desenvolvimento, uma variável `OPENAI_API_KEY` válida exportada no terminal tem prioridade sobre `.env`; em seguida vem a chave importada no cofre. O arquivo aceita comentários e valores entre aspas, sem executar comandos ou expandir variáveis. Arquivo ausente, ilegível, acima de 16 KiB ou chave vazia/inválida é ignorado, preservando o cofre e a transcrição local. Builds empacotados usam somente o cofre, sem ler `.env` ou a variável do terminal.

## Diagnosticar sugestões

Durante a transcrição local, abra **Preferências → Diagnóstico → Diagnóstico OpenAI** para ver o modelo, a classificação local, as tentativas, o status HTTP e a duração da última chamada. **Ver corpo da última requisição** mostra o texto, o resumo, as instruções e o formato enviados. Abrir o diagnóstico não faz chamadas.

Para testar o fluxo, inicie uma sessão com **Adicionar sugestões de IA**, autorize o envio e diga em Português (Brasil): “Qual é o prazo do projeto fictício Aurora?”. Aguarde a fala final. O painel diferencia espera por fala final, chamada em andamento, resposta vazia e falhas. Trechos finais são agrupados para avaliação, com intervalo mínimo de 10 segundos. O limite inicial é de 10 tentativas, inclusive falhas; após esgotá-lo, pare e inicie outra sessão autorizada. A API tem cobrança separada do ChatGPT Plus.

O diagnóstico fica em memória e só guarda a última tentativa. Pausar limpa o corpo; parar ou desativar sugestões limpa tudo. Uma chamada cancelada pode já ter sido enviada. Dados sintéticos dos testes automatizados não comprovam a conexão real da sua conta.

## Documentação

- [PRD](docs/PRD.md) — escopo e comportamento esperado.
- [Roadmap](docs/ROADMAP.md) e [tarefas](docs/TASKS.md) — marcos, dependências e aceite.
- [Progresso](docs/PROGRESS.md) — snapshot atual e próximo passo; histórico detalhado em [PROGRESS-HISTORY](docs/PROGRESS-HISTORY.md).
- [Decisões](docs/DECISIONS.md) — decisões confirmadas e questões abertas.
- [Arquitetura](docs/ARCHITECTURE.md) — proposta técnica e fronteiras do sistema.
- [Padrões de engenharia](docs/ENGINEERING-STANDARDS.md) e [fluxo de trabalho](docs/WORKFLOW.md) — contribuições e validação.

`docs/TASKS.md` é a fonte de estado e aceite; `docs/PROGRESS.md` é o handoff atual. Evidências detalhadas ficam nos documentos especializados ligados por tarefa. `docs/ARCHITECTURE.md` descreve uma proposta, não o status implementado.
