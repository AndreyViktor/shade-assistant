# Referência técnica opcional — reconhecimento de fala Apple

**Não é parte da arquitetura de runtime, dependência do produto nem requisito para executar o aplicativo.**

## Repositório de referência

- **Projeto:** [`k1LoW/vo`](https://github.com/k1LoW/vo) — implementação pública de captura/transcrição no macOS usando APIs Apple.
- **Para o agente de desenvolvimento:** pode consultar o código-fonte apenas como **material de estudo** sobre uso de `SpeechAnalyzer`, `SpeechTranscriber`, captura mic/system, concorrência, permissões, múltiplos idiomas e tratamento de eventos. Antes de copiar qualquer trecho, **verificar a licença da versão consultada**, atender às condições aplicáveis, registrar a origem e realizar revisão de segurança; preferir implementação própria. Não presumir que código externo tenha a mesma API/compatibilidade do SDK instalado.
- **É proibido** incluir, executar, instalar ou empacotar esse executável no nosso app; **não criar adapter** para ele; não copiar automaticamente CLI/JSONL/schema como se fossem nosso protocolo.

## Evidência exploratória registrada na conversa (02/11/2026)

- Uso manual no Terminal do Mac do usuário; **não** foram disponibilizados logs ou benchmark científico.
- Em `pt-BR`, transcrição do microfone e do áudio reproduzido pelo computador considerada boa, com pontuação adequada.
- Em `pt-BR,en-US`, alternância entre idiomas funcionou com falhas pontuais; usuário estimou informalmente cerca de **80%** de funcionamento adequado. Isso **não é medição quantitativa e não se transfere ao Swift próprio**.

## O que precisa ser comprovado no nosso produto

- Disponibilidade do Apple SDK e dos assets pt-BR/en-US no Mac alvo, captura e separação de mic/system, cancelamento e limpeza de recursos.
- Transcrição com nosso helper Swift, schema JSONL próprio e ponte Electron→renderer, alternância bilíngue e latência.
- Permissões TCC, empacotamento/assinatura/notarização e comportamento em compartilhamento de tela.

Todas essas validações permanecem `TODO` no backlog até haver teste do **código do aplicativo**.
