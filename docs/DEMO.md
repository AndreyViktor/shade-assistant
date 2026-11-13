# Demonstração local

O modo `DEMO` exercita a interface e o ciclo de sessão sem microfone, captura de sistema, chave ou rede. As falas, fontes e sugestões são simuladas; isso não demonstra STT Apple nem integração com OpenAI.

## Iniciar

Na raiz do projeto, instale as dependências conforme [README.md](../README.md) e execute:

```bash
npm run dev
```

O painel abre na transcrição local, com captura inativa. A demonstração fica somente em **Preferências → Diagnóstico · DEMO offline**, recolhida até abertura explícita.

## Roteiro

1. Abra **Preferências**, expanda **Diagnóstico · DEMO offline** e selecione **Iniciar DEMO**. A reprodução apresenta três falas fixas em português, identificadas por fontes simuladas (`mic` e `system`).
2. A fala inicial não gera cartão. A pergunta sobre riscos gera uma sugestão; o compromisso de levantamento demonstra outra etapa do roteiro.
3. Use **Pausar** e **Retomar** para observar o ciclo. **Parar** limpa a sessão; iniciar novamente reproduz o mesmo roteiro.
4. Descarte cartões pelos controles disponíveis. Os cartões expiram após 30 segundos, inclusive durante uma pausa.
5. Altere e salve as preferências; elas valem para a próxima sessão local. A DEMO continua com roteiro fixo em português e não usa a chave/modelo configurados. Voltar ao painel ou usar Escape preserva a simulação; o painel identifica DEMO ativa e permite pará-la. Reabra Preferências para consultar o roteiro e seus controles.
6. Pare a DEMO antes de iniciar uma transcrição local; a confirmação de captura e o opt-in de sugestões continuam obrigatórios. Uma sessão local ativa também impede iniciar DEMO.

O roteiro não grava áudio, não persiste transcrição e não faz chamadas de rede. Recarregar ou fechar a janela encerra a sessão.

## Verificação automatizada

```bash
npm run test:smoke
```

Esse teste abre o Electron real e verifica o fluxo DEMO, mas requer uma sessão gráfica local. Não testa captura, permissões macOS/TCC, reconhecimento Swift nem envio real à API.

Para limites, comportamento dos cartões e consentimento, consulte [PRD.md](PRD.md), [TASKS.md](TASKS.md) e os ADRs vinculados por eles.
