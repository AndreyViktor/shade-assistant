# Evidências T052 — instruções de transcrição e assistência proativa

## Escopo

O prompt do provedor orienta o modelo a tratar a entrada como transcrição automática imperfeita, preservar incertezas e não reescrever a fala. Também orienta inferência proativa a partir da conversa, sem exigir mais contexto nem perguntar diretamente ao usuário; se a ambiguidade impedir ajuda fundamentada, o modelo pode sugerir uma pergunta para os participantes ou não gerar cartão.

O teste do provedor verifica essas instruções no corpo sintético enviado à API. Consentimento, contexto de sessão, formato, limite, transporte e dados da requisição não foram alterados.

## Validação

- `env PATH=/opt/homebrew/opt/node@26/bin:$PATH npm run verify` — passou.
- Lint, Prettier, três projetos TypeScript e build Electron — passaram.
- Vitest: 48 arquivos passaram, 3 ignorados; 866 testes passaram, 18 ignorados.
- Runner: 19 testes passaram.
- O teste do provedor usa transporte e chave sintéticos. Nenhuma chamada à OpenAI, reunião real ou custo ocorreu.

## Limites

O teste confirma que as instruções estão presentes no payload, não mede a qualidade semântica das respostas de um modelo ao vivo. Essa avaliação deve ocorrer durante o uso real da funcionalidade, com autorização e orçamento da API do usuário.
