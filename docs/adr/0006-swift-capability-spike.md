# ADR 0006 — Diagnóstico Swift independente e gates nativos

Data: 2026-11-03. Tarefa: T005. Estado: aceito.

## Contexto

Precisamos verificar as APIs Apple no Mac atual antes da POC de captura. O app Electron ainda não tem provider nativo. Evidência de ferramenta externa não comprova nosso código, e consultar capacidade não deve iniciar captura ou instalar modelos.

## Decisão

- Criar `native/macos/Package.swift`, sem dependências externas, e o executável próprio `MeetingCopilotCapabilities`. Ele consulta Speech, AssetInventory e estado das permissões; constrói/cancela um SpeechAnalyzer por locale suportado, sem entrada de áudio. Preparação de modelo só ocorre quando **ambas** as consultas de assets indicam instalação.
- Manter o diagnóstico separado do futuro `MeetingCopilotTranscriber`. O JSON único, `reportVersion: 1`, é um relatório técnico; não define o protocolo JSONL/IPC de T012 e não é consumido pelo renderer.
- Usar Swift 6, manifest tools 6.2 e SDK macOS 26+. Deployment target do diagnóstico: macOS 14; APIs Speech novas protegidas por `#available(macOS 26.0, *)`. Build/test real somente no arm64/macOS 26.6.2 atual. Incompatibilidade retorna motivo explícito e recomendação DEMO; nunca ativa STT remoto.
- Consultar TCC com `AVCaptureDevice.authorizationStatus(for: .audio)` e `CGPreflightScreenCaptureAccess()`. Não chamar requests de autorização, captura, reserva/liberação de assets ou instalação. O preflight de tela não prova acesso a áudio do sistema por ScreenCaptureKit.
- Usar Swift Testing e **swift-format 6.3.0**, já fornecido pelo Xcode, com configuração completa versionada e regras contra force unwrap/try. `verify:swift` exige essa versão, lint estrito, testes e build release com warnings como erros. SwiftLint e SwiftFormat não estavam instalados; nenhuma instalação feita. São ferramentas distintas de swift-format.
- Preservar `npm run verify` multiplataforma; `npm run verify:swift` é gate adicional obrigatório para alterações nativas, executado no Mac. Não criar CI que simule sucesso sem SDK/hardware.

## Alternativas e consequências

Executar transcritor externo ou acoplar a consulta ao Electron anteciparia contratos ainda não definidos. Baixar modelos ou pedir TCC durante diagnóstico introduziria efeitos desnecessários. Por isso o relatório pode apontar assets/permissões pendentes: esse é um resultado do spike, não comprovação de streaming.

Chamadas a serviços do SO podem bloquear; o CLI encerra após 30 segundos com código seguro, sem imprimir erros privados. Não aceita argumentos ou comandos de captura. O encerramento abrupto do watchdog é específico deste processo de diagnóstico sem áudio; não substitui lifecycle do helper futuro.

Consultas dentro da sandbox do agente retornaram catálogos vazios; a evidência de hardware foi obtida por escalada aprovada, sem alterar sandbox/TCC. Disponibilidade precisa ser reavaliada no contexto do futuro bundle assinado. O relatório e seus limites estão em [T005-SWIFT-CAPABILITIES.md](../T005-SWIFT-CAPABILITIES.md).
