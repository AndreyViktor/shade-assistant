# ADR 0024 — Fonte de áudio persistida e preferências v3

Data: 2026-11-13. Tarefa: T047. Complementa [ADR 0023](0023-settings-screen-and-preferences-v2.md); substitui apenas a decisão de manter a fonte como seleção temporária no painel.

## Contexto

T047 move a fonte para Preferências, junto do idioma e dos fornecedores. A seleção precisa sobreviver ao reinício, sem aplicar mudanças à captura ativa nem reutilizar autorização de uma sessão anterior.

## Decisão

- `Preferences` v3 acrescenta `audioSource: mic | system | both`. O padrão é `both`, igual ao painel anterior. Nenhum consentimento, limite, áudio, transcrição ou segredo é persistido nessa estrutura.
- O parser atual é estrito; main/preload só aceitam v3 em settings IPC. O envelope settings continua v1 e sessão v6, com as mesmas operações. Clientes antigos são recusados explicitamente pelo parser.
- A migração é exclusiva de disco: v2 estrita preserva modo, provedor STT, idioma, provedor/modelo de sugestões e acrescenta `both`; v1 estrita migra diretamente para v3, mantendo a conversão bilíngue anterior para pt-BR. Versões desconhecidas, campos extras e valores inválidos falham sem sobrescrever o arquivo.
- `PreferencesStore` mantém o caminho histórico `preferences.v1.json`, escrita privada atômica existente e migração uma vez. A versão interna define o formato; não há arquivo paralelo nem downgrade.
- A tela organiza Transcrição de áudio (fonte/provedor/idioma), Sugestões de IA (provedor/modelo/chave e estado da conexão), Permissões e privacidade e Diagnóstico (incluindo DEMO). A conexão é observada pelo diagnóstico já existente; abrir Preferências não testa rede nem chave.
- O início usa a fonte salva e a apresenta na confirmação. Salvar em andamento ou pausado só afeta o próximo início, sem comando de sessão ou recriação do provider. A UI informa essa regra. Abrir/fechar a tela mantém o hook e a captura ativos. Troca imediata continua fora do escopo (T050).
- Importar/remover chave usa as operações existentes, sem segredo no renderer; essas ações não submetem o formulário e preservam seu rascunho. Salvar preferências não concede acesso nem autoriza texto/custo. O opt-in e o limite continuam sendo confirmados a cada sessão.

## Alternativas e consequências

Persistir sem nova versão tornaria o contrato ambíguo e a migração silenciosa. Aplicar a fonte à sessão ativa mudaria o ciclo de captura e o consentimento, escopo reservado a T050. O padrão ambas mantém o comportamento anterior, mas exige novamente confirmação explícita antes de capturar. Nenhuma mudança em Swift, cofre ou transporte OpenAI.

## Validação

Contratos, migração de v1/v2, persistência e sessão ativa/pausada offline são registrados em [TEST-T047.md](../TEST-T047.md), com resultados reais e limites de ambiente.
