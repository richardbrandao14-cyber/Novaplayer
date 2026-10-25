# Regras de desenvolvimento do NOVA PLAYER

## Autoridade e escopo

- Escopo atual autorizado: páginas cinematográficas de TV/filmes/séries, menu recolhível, rolagem sem barras, TV primeiro clique em prévia lateral e segundo em fullscreen sem recarregar, filme com detalhes/favoritos/Minha Lista/retomada, série em página própria com temporadas e imagens reais dos episódios. Favoritos/progresso persistem no SQLite v2. Imagens fornecidas têm preferência; extração nativa usa um decoder sem áudio, cache limitado e cancelamento prioritário ao reproduzir. Testar no Windows antes de entregar.
- Marco manual: proprietário confirmou que Horizon funcionou com vídeo/áudio no Windows na versão anterior. Novo pedido autorizado: player na mesma janela, HUD sobre o vídeo, um clique para canal/filme/episódio e biblioteca cinematográfica conforme referências. Validar nova composição HWND/HUD no Windows antes de entregar; não presumir que o marco anterior aprova essa mudança.
- Atualização de escopo: o proprietário autorizou explicitamente corrigir Xtream e implementar reprodução nativa com áudio. Executar primeiro a PoC Windows isolada de libmpv; só habilitar a integração após esse gate automatizado. Sem instalador, Release ou publicação.
- M3U/Xtream/SQLite e catálogo real já implementados. Registro de reprodução em docs/PLAYBACK_CHECKPOINT.md; não declarar som audível ou provedor real validados por testes com saídas nulas.
- Desenvolver uma fase por vez, com aprovação técnica documentada; mudanças relevantes de arquitetura, custos ou limitações devem ser explicadas antes de execução.
- Inspecionar `git status`, arquivos e instruções antes de alterar. Preservar trabalho do usuário; não sobrescrever, resetar, publicar ou enviar commits sem autorização correspondente.
- Usar o checkout existente. Cada tarefa cloud já é isolada; não criar worktree sem pedido explícito.

## Implementação

- Único alvo do produto no momento: Windows 10/11 x64. Não criar builds, instaladores ou compatibilidade desktop Linux/macOS. Linux cloud/CI pode executar ferramentas, testes web e testes do núcleo Rust sem WebView (`--no-default-features`); validação da aplicação nativa e proteção Windows ocorre no Windows.

- Seguir ARCHITECTURE.md, DESIGN_SYSTEM.md e TESTING.md. Registrar desvios justificados.
- Estabilidade, tipagem rigorosa, módulos pequenos, contratos explícitos e testes proporcionais à mudança.
- Confirmar versões estáveis, engines, peers e toolchain antes da instalação. Fixar versões e manter package-lock.json/Cargo.lock; usar instalações congeladas depois de criados.
- Adicionar apenas dependências exigidas pelo marco atual. Não integrar libmpv antes da PoC Windows; não substituir reprodução nativa por simulação silenciosa.
- Nunca colocar credenciais em logs, snapshots, fixtures, mensagens, repositório ou armazenamento web. Não enviar URLs sensíveis pelo frontend sem necessidade.
- Dados de demonstração devem ser isolados, identificados e nunca usados como fallback para esconder falhas reais.
- Não adicionar serviços pagos, cobrança, autenticação remota, metadados externos ou publicar o aplicativo sem autorização.
- Preservar TLS, assinaturas e verificações de integridade. Privilégios Tauri mínimos; não habilitar shell/fs/http genéricos para a interface.

## Validação e relato

- Não remover testes, ignorar erros de build ou declarar comandos não executados como aprovados.
- Separar evidência web, build frontend, testes Rust, build Tauri, reprodução libmpv e instalador manual Windows.
- Não prometer desempenho, suporte universal a provedores/codecs ou timeshift sem validação.
- Após cada fase informar: implementação, testes executados, testes não realizados, erros, riscos e próxima etapa. Não iniciar a próxima fase automaticamente.
- Na configuração cloud, mudanças em código e manifests pertencem à tarefa de desenvolvimento autorizada, não ao onboarding. Salvar instruções de instalação/startup somente quando existirem passos reais testados.
