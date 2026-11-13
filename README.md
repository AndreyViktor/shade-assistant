# Meeting Copilot

Assistente desktop de reuniões em tempo real, feito com Electron, React e TypeScript. O objetivo do MVP é executar localmente no macOS, com transcrição Apple implementada pelo projeto em Swift e sugestões de IA opcionais e autorizadas.

## Status

O scaffold desktop, a demonstração offline e a integração do helper Swift ao Electron estão implementados. Apple Local agora exibe falas recentes no overlay (T017), com fonte, idioma e estado; o ensaio manual está em [docs/TEST-T017.md](docs/TEST-T017.md). A T016, fallback OpenAI STT, está adiada. O app não está pronto para distribuição. Windows (T036–T039) permanece adiado.

## Executar

Requer Node.js **26.0.0** (`.nvmrc`) e npm. Com `nvm` instalado:

```bash
nvm use
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run dev
```

No macOS, `npm run dev` também compila o helper Swift dentro de um app nativo com descrições de uso do microfone e do áudio do sistema. A aplicação abre sem captura ativa, com Apple Local como ação principal e DEMO offline disponível em **Preferências → Diagnóstico · DEMO offline**. Apple Local só solicita permissões após seleção do modo, consentimento explícito e início da sessão. A primeira autorização de gravação de tela/áudio pode exigir aprovação em Ajustes do Sistema e reabertura do Meeting Copilot. Para compilar e abrir o build:

```bash
npm run build
npm start
```

Instruções adicionais de instalação, testes e gates Swift estão em [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). O roteiro de demonstração está em [docs/DEMO.md](docs/DEMO.md). O ensaio real da transcrição no overlay está em [docs/TEST-T017.md](docs/TEST-T017.md).

## Preferências e início da sessão

Abra **Preferências** para escolher idioma, fornecedor de transcrição (Apple Local), fornecedor de sugestões (OpenAI) e modelo. **Salvar preferências** aplica as escolhas ao próximo início. **Voltar ao painel** ou Escape retorna à reunião; navegar não pausa nem encerra a sessão. OpenAI STT continua indisponível.

A chave pode ser importada/removida em **Preferências → Chave OpenAI** pelo seletor seguro do Mac. Para iniciar, confirme a captura; sugestões exigem **Adicionar sugestões de IA**, autorização de envio/custo e limite de pedidos novamente a cada sessão. Essas autorizações não ficam salvas.

Preferências antigas são migradas automaticamente; a opção bilíngue legada passa a pt-BR, pois reconhecimento simultâneo não está implementado. Arquivos inválidos não são sobrescritos.

## Chave OpenAI no desenvolvimento

Para sugestões de IA, copie `.env.example` para `.env` na raiz do projeto e preencha:

```dotenv
OPENAI_API_KEY=sua_chave_da_api
```

Reinicie com `npm run dev`. A chave é lida somente pelo processo principal; a interface mostra apenas se está configurada. O `.env` fica fora do Git, mas contém texto simples: não o compartilhe nem use prefixos `VITE_` para segredos. A transcrição local não precisa de chave. As sugestões continuam dependendo de autorização na sessão e usam a API paga separadamente do ChatGPT Plus.

Em desenvolvimento, uma variável `OPENAI_API_KEY` válida exportada no terminal tem prioridade sobre `.env`; em seguida vem a chave importada no cofre. O arquivo aceita comentários e valores entre aspas, sem executar comandos ou expandir variáveis. Arquivo ausente, ilegível, acima de 16 KiB ou chave vazia/inválida é ignorado, preservando o cofre e a transcrição local. Builds empacotados usam somente o cofre, sem ler `.env` ou a variável do terminal.

## Diagnosticar sugestões

Durante a transcrição local, **Estado da OpenAI → Diagnóstico OpenAI** mostra o modelo, classificação local informativa, tentativas, HTTP e duração da última chamada. **Ver corpo da última requisição** mostra o texto/resumo, instruções e formato enviados; a chave fica oculta. Abrir o painel não faz chamadas.

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
