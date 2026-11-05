# Decisões e questões abertas — Meeting Copilot

Decisões confirmadas pelo usuário prevalecem sobre propostas e hipóteses antigas. Padrões e gates de código ficam em [ENGINEERING-STANDARDS.md](ENGINEERING-STANDARDS.md); o escopo do produto, em [PRD.md](PRD.md).

## Decisões confirmadas

- **D001–D006:** app desktop Electron + React + TypeScript; execução local como prioridade; assistência durante reuniões autorizadas; proteção do overlay desejada sem prometer invisibilidade; Codex como ferramenta de desenvolvimento; OpenAI API preferida para sugestões e visão.
- **D007–D009:** transcrição Apple local prioritária no Mac; macOS primeiro; o MVP implementará seu próprio módulo de transcrição em Swift usando APIs Apple. STT remoto OpenAI é fallback consentido; ferramentas externas de STT não serão dependências do produto.
- **D010–D011:** oferecer pt-BR e avaliar pt-BR+en-US somente após validação; o MVP atual é macOS. M6 e tarefas Windows T036–T039 ficam `DEFERRED` até nova decisão.
- **D012:** priorizar código organizado, testável e fácil de manter; seguir os padrões de engenharia do projeto.
- **D013–D015:** Git local simples, ao menos um commit por tarefa concluída e sem push automático; uma sessão Codex nova por tarefa; executor Python opcional e limitado para abrir `codex exec` independente por tarefa.

## Propostas técnicas reversíveis

Defaults sujeitos a validação de implementação; detalhes do fluxo e fronteiras estão em [ARCHITECTURE.md](ARCHITECTURE.md).

- **P001:** helper Swift próprio `MeetingCopilotTranscriber`, protocolo JSONL versionado do projeto, `spawn` sem shell e IPC restrito.
- **P002–P003:** Responses API para sugestões e visão, com modelos configuráveis e verificados quanto à disponibilidade, custo, latência e qualidade antes da integração.
- **P004–P006:** zero a duas sugestões; gatilhos relevantes e silêncio deliberado; janela curta de contexto, cooldown inicial e expiração; DEMO offline e dados em memória por padrão.
- **P007–P008:** chave do usuário protegida pelo cofre do sistema; limites de custo; providers selecionáveis. Áudio só sai do Mac no fallback remoto opt-in.
- **P009:** usar os padrões de engenharia existentes, com boundaries testados, testes e gates reproduzíveis; evitar camadas ou frameworks sem necessidade demonstrada.

## Custos e privacidade

O uso da API é faturado separadamente da assinatura ChatGPT/Codex. Antes de qualquer teste pago, verificar preços, disponibilidade e saldo atuais; não habilitar faturamento, comprar créditos nem criar credenciais sem autorização. Na transcrição Apple local, áudio permanece no dispositivo, mas texto enviado para sugestões e imagens confirmadas podem ser enviados à OpenAI. Fallback remoto de STT envia áudio após consentimento específico.

## Questões abertas

Não bloqueiam tarefas independentes; atualize esta lista quando houver decisão do usuário.

- **O001:** estilo, frequência e nível de intervenção das sugestões.
- **O002:** validar o Swift próprio, integração Swift→Electron e qualidade real do modo bilíngue; resultados exploratórios não comprovam a implementação.
- **O003:** medir qualidade, latência, recursos e custos em uso representativo.
- **O004:** requisitos de consentimento e privacidade nos diferentes contextos de reunião.
- **O005:** macOS/hardware mínimos, disponibilidade de idiomas/assets, permissões TCC, assinatura/notarização e experiência em máquinas novas.
- **O006:** política para retenção opcional de histórico e perfis de reunião; o padrão atual é temporário/em memória.
- **O007:** necessidade de consultar documentos ou materiais do usuário durante a reunião; fora do escopo atual.

## Como aplicar

Defaults reversíveis podem mudar com justificativa e testes. Alterações de fronteira, contrato, tecnologia fundamental ou segurança exigem ADR. Não conceder permissões administrativas, instalar drivers, remover proteções do sistema, publicar, fazer push ou autorizar custos sem consentimento humano.
