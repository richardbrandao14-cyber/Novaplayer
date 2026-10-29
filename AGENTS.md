# Regras de desenvolvimento do NOVA PLAYER

## Autoridade e escopo

- webOS 0.4.5: perfis circulares com edição separada; transporte em ícones retroceder/play-pause/avançar/ajustes. Barra focada busca por ←/→ diretamente (substitui modo OK anterior). Retomada precisa confirmação seeked/timeupdate e retries limitados, bloqueando gravação de progresso até confirmação; falha visível preserva posição. Favoritos têm filtros Filmes/Séries/TV; Continue nunca TV. TV tem segundo painel lateral com parentesco real da fonte; foco explícito canais→prévia→controles e retorno. Catálogo Voltar foca categoria mãe. Filmes/séries recolhem menu aos ícones, expansão sem reflow dos cartões. Validar controle e geometria em Chromium, confirmar mídia na LG física.


- webOS 0.4.4 autorizado: até cinco perfis locais por fonte/conta. Exceção explícita de armazenamento público: IDs e nomes de perfil escolhidos pelo usuário, seleção e formato base; nunca credenciais. Perfil default preserva chave antiga; progresso/favoritos/Minha lista/preferências separados. Troca interrompe a reprodução antes de mudar perfil. Continue só filmes/séries, indexado por parentId, sem varrer todo progresso por série. Banner e diálogo de retomada usam apenas progresso/duração reais do perfil. Capas com três downloads visíveis/prioridade/cancelamento; sem reflow forçado do banner ou filtros pesados. Medidas Node não equivalem à TV.

- webOS 0.4.3: ↑/↓ trocam canais somente com HUD oculto; HUD aberto e painéis usam as setas para navegação. ChannelUp/Down e botões próprios trocam explicitamente. Seek depende de janela seekable real. Temporadas em botões confirmados por OK, com foco inicial e ida/volta explícita aos episódios, rolagem horizontal e movimento reduzido. Não restaurar o select nativo nem o zap incondicional.

- webOS 0.4.2: menu lateral principal/subcategorias, foco ordenado por controle, busca central e transições com movimento reduzido. ↑/↓ trocam somente TV em fullscreen fora de diálogos, seguindo filtro atual. Prévia sem recorte, HUD compacto e geometria explícita; validar imagem na LG física, não alegar correção só com Chromium. Não animar o plano de vídeo nativo.

- UHD webOS autorizado: preservar fluxo original, indicador real de dimensões e amostra sintética 3840×2160. Não confundir canvas lógico da UI com decoder/saída 4K nem mudar manifesto para 3840 sem prova LG. Detalhes em docs/WEBOS_LIBRARY_CHECKPOINT.md.

- webOS 0.4.0: proprietário exigiu aceitar http:domínio, corrigir foco dos campos/catalogo vazio e seguir novas referências com navegação superior + imagem cinematográfica integrada. D.source separa endpoint/acesso/parâmetros de links Xtream; extras sensíveis só RAM/cifra no cofre. Não consultar os domínios reais fornecidos em testes. Streams carregam antes das categorias, falhas precisam ficar visíveis. Não alegar correção do provedor real sem teste.

- Escopo webOS 0.3.0 autorizado pelo pedido de app funcional: persistir IDs de favoritos/progresso/preferências por lista (sem metadados ou URLs); acesso opcional somente cifrado AES-GCM por WebCrypto nativo e senha de desbloqueio não persistida. A proibição abaixo refere-se a credenciais em texto aberto; sem WebCrypto não criar fallback. EPG/áudio/legendas condicionados à fonte e APIs reais; manter diferenças entre contrato jsdom, mídia Chromium e teste LG. Critérios em docs/WEBOS_LIBRARY_CHECKPOINT.md.

- Atualização autorizada webOS: após confirmar teste real de canais, proprietário pediu biblioteca de uso com UI cinematográfica, catálogo sem corte em 40, Voltar interno e entrada flexível do servidor. Implementação isolada 0.2.0; critérios e limites em docs/WEBOS_LIBRARY_CHECKPOINT.md. Não publicar loja; não confundir testes Chromium com TV física. Proteger credenciais; persistência somente nos termos do marco 0.3.0 acima.

- Autorização adicional: prova de conceito LG webOS isolada em platforms/webos-poc, alvo informado UM7510PSB/firmware 05.40.97. Só pacote .ipk de desenvolvimento, controle remoto e teste direto de mídia; não migrar produção Windows, publicar em loja ou presumir teste físico. Regras/instalação em platforms/webos-poc/README.md. Preservar alterações Windows em andamento fora do commit dessa prova.

- Direção visual atual autorizada: NEX, assinatura laranja e cantos arredondados, abertura breve não bloqueante e banners adaptativos baseados nas imagens fornecidas. Ler seção NEX em DESIGN_SYSTEM.md e src/ui/nex.css. Preservar identificador Tauri, productName técnico, storage/diretórios e contratos nativos; título/ícone visíveis NEX. Não confundir rebrand visual com migração. Não inventar “Em alta”, lançamentos ou personalização; IA externa/paga não foi integrada. Recomendações locais, próximo episódio com contagem e pular abertura com marcadores confiáveis ficam para etapa funcional posterior.

- Correção atual autorizada: favoritos de TV persistidos com filtro próprio; HUD deve funcionar por clique/roda, não somente desenhar. `input-default-bindings=yes` habilita vínculos fracos de scripts; o OSC também exige entrada de mouse válida e host com SS_NOTIFY/HTCLIENT; `input-builtin-bindings=no` impede atalhos padrão indesejados. Testar HTCLIENT/movimento da janela e estado de pausa/volume por hit-testing do OSC; mpv --wid desabilita o filho com EnableWindow(...,0); habilitar sua entrada na criação/recriação. A regressão deve comprovar estado desabilitado original → habilitado e usar WM_LBUTTONDOWN/UP, sem substituir os botões por keydown/keyup da API do mpv. Não confundir com clique manual no Tauri/WebView2. Capas com até quatro downloads/dois processamentos, cache compartilhado e prioridades; preservar proteções de URL/TLS.
- Tela cheia: controles/cabeçalho nativos aparecem com interação e somem após cerca de cinco segundos, inclusive pausado. Não deixar faixa HTML fixa; mouse sobre HWND não gera eventos DOM. Preservar Voltar, Ajustes e acesso a episódios. Temporizadores, bindings e overlays devem ser encerrados/restaurados ao sair. Validar prazo e reativação na PoC Windows, além do fallback web.
- Navegação adicional autorizada: clicar em Filmes/Séries troca o mesmo menu lateral pelas categorias reais dessa seção, com retorno ao menu principal e atalho Início. Busca global deve ser destacada; durante prévia de TV oculta somente o HWND ao abrir o diálogo e restaura a mesma sessão ao fechar. Filtros por fonte/categoria/página são separados por seção em memória, sem credenciais.
- Escopo atual autorizado: páginas cinematográficas de TV/filmes/séries, menu recolhível, rolagem sem barras, TV primeiro clique em prévia lateral e segundo em fullscreen sem recarregar, filme com detalhes/favoritos/Minha Lista/retomada, série em página própria com temporadas e imagens reais dos episódios. Favoritos/progresso persistem no SQLite v2. Imagens fornecidas têm preferência; extração nativa usa um decoder sem áudio, cache limitado e cancelamento prioritário ao reproduzir. Testar no Windows antes de entregar.
- Marco manual: proprietário confirmou que Horizon funcionou com vídeo/áudio no Windows na versão anterior. Novo pedido autorizado: player na mesma janela, HUD sobre o vídeo, um clique para canal/filme/episódio e biblioteca cinematográfica conforme referências. Validar nova composição HWND/HUD no Windows antes de entregar; não presumir que o marco anterior aprova essa mudança.
- Atualização de escopo: o proprietário autorizou explicitamente corrigir Xtream e implementar reprodução nativa com áudio. Executar primeiro a PoC Windows isolada de libmpv; só habilitar a integração após esse gate automatizado. Sem instalador, Release ou publicação.
- M3U/Xtream/SQLite e catálogo real já implementados. Registro de reprodução em docs/PLAYBACK_CHECKPOINT.md; não declarar som audível ou provedor real validados por testes com saídas nulas.
- Desenvolver uma fase por vez, com aprovação técnica documentada; mudanças relevantes de arquitetura, custos ou limitações devem ser explicadas antes de execução.
- Inspecionar `git status`, arquivos e instruções antes de alterar. Preservar trabalho do usuário; não sobrescrever, resetar, publicar ou enviar commits sem autorização correspondente.
- Usar o checkout existente. Cada tarefa cloud já é isolada; não criar worktree sem pedido explícito.

## Implementação

- Alvo de produção: Windows 10/11 x64; a PoC webOS acima é a exceção isolada autorizada. Não criar builds, instaladores ou compatibilidade desktop Linux/macOS. Linux cloud/CI pode executar ferramentas, testes web e testes do núcleo Rust sem WebView (`--no-default-features`); validação da aplicação nativa e proteção Windows ocorre no Windows.

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
