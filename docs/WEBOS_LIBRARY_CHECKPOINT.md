# NEX webOS 0.4.0 — biblioteca de uso

## Escopo e evidências

O proprietário autorizou evoluir a PoC para a biblioteca webOS após confirmar interface, vídeo/som locais e teste de canais da fonte real na LG UM7510PSB (firmware 05.40.97). Filmes e séries reais na LG ainda não foram confirmados. Não é publicação em loja, instalador Windows nem certificação de produção.

Implementação isolada em `platforms/webos-poc`. Código ES5, sem dependências de execução remotas; CSS e scripts embutidos com hashes CSP. Windows e suas alterações em andamento foram preservados.

## Comportamento

- Cadastro aceita servidor HTTP, HTTPS, domínio/IP com porta e caminho; sem esquema assume HTTP. Esquema explícito é preservado, HTTPS não sofre downgrade automático. Xtream usa HTTP(S); arquivos locais, JavaScript, FTP e credenciais embutidas no domínio continuam rejeitados. Links completos Xtream são separados em base, acesso e parâmetros; a base técnica permanece sem query.
- Após autenticação: navegação Início, TV ao vivo, Filmes, Séries, Favoritos, Continuar assistindo, Configurações e Minha fonte. Home usa filmes reais da fonte, sem alegar popularidade ou recomendação.
- Categorias reais, busca na seção inteira e paginação de 48 cartões. Todos os registros recebidos ficam disponíveis; não existe corte em 40. Filtro em blocos de mil registros com cancelamento. Um catálogo por tipo é compartilhado em memória entre páginas/histórico, evitando novas cópias ao navegar; reconectar renova esses dados. Continua existindo limite de segurança de 32 MiB por resposta e timeout de 30 s. JSON é processado no navegador; consumo e fluidez na TV real não foram medidos.
- Filmes abrem detalhes antes de reproduzir, consultando `get_vod_info`. Série usa `get_series_info`, seletor de temporada e 24 episódios por página, título e imagem quando fornecidos. Próximo episódio por botão e contagem automática de dez segundos ao terminar, com cancelamento e preferência persistida, atravessando temporadas na ordem fornecida. Sem trailer inventado, extração de frames ou pular abertura sem marcadores.
- Canal abre em prévia lateral. Segundo clique ou botão amplia a mesma sessão. Voltar da tela cheia ao vivo retorna à prévia; outro Voltar fecha. Catálogo/busca continuam disponíveis durante a prévia.
- Voltar curto (461/Escape) é consumido em todas as telas. Histórico interno limitado a oito contextos, preservando filtro/página/temporada; início não chama saída do app. `disableBackHistoryAPI: true` evita o tratamento padrão do histórico webOS. Tecla física e eventuais ações reservadas do sistema exigem validação LG.
- HUD funcional: pausa, busca quando suportada, velocidade, tempo e próximo episódio. Some após cinco segundos; interação o revela. Primeiro OK com HUD oculto apenas revela, evitando pausa acidental. Volume pelo controle da TV.
- Favoritos por tipo e progresso persistem por lista, identificada por SHA-256 de servidor/usuário. Persistência pública contém apenas IDs, posição, duração e preferências, com limites de quatro mil favoritos/dois mil registros de progresso. Dados corrompidos/quota geram mensagens; apagar histórico/favoritos exige confirmação e não apaga preferências.
- Acesso opcional protegido por senha de desbloqueio (mínimo oito caracteres), usando PBKDF2-SHA256 de 150 mil iterações, sal aleatório de 16 bytes, AES-GCM-256 com IV aleatório de 12 bytes e contexto autenticado. Nada de chave/senha persistida junto da cifra. Sem WebCrypto, não existe fallback em texto aberto. Esta disponibilidade ainda depende do runtime real LG. Implementação nativa de criptografia; SHA-256 ES5 é usado apenas para namespace, com vetores confrontados ao Node crypto.
- EPG por `get_short_epg`, Base64/UTF-8 e timestamps fornecidos, DOM textContent. Áudio por audioTracks e legendas por textTracks; ausência desses dados/APIs desabilita a seleção. Não afirmar suporte de faixas internas que a TV não expõe.
- Recuperação de erro de rede até três vezes, espera crescente, preservação da posição quando possível, interrupção ao sair e tentativa manual. Erro de codec não é recuperado por loop de rede. Indicador offline usa navigator.onLine, sem alegar medição de velocidade/conectividade do provedor.


## Verificação

Executar os testes documentados em `platforms/webos-poc/README.md`. Regressões incluem sintaxe ES5, URLs com/sem esquema, preservação de HTTPS/credenciais codificadas, catálogo com 50 mil registros, busca do último item, categoria, paginação, filme/detalhes, favorito de canal, episódio/temporada/próximo, reprodução MP4 sintética, HUD e retorno LG cancelável. Verificação de imagens remotas exige `naturalWidth > 0`, pois a revisão encontrou CSP que as bloqueava. Capturas contêm apenas obras e arte sintéticas identificadas.

Limites: navegador Chromium não certifica codecs, áudio audível, CORS/TLS do provedor nem funcionamento físico do Voltar. A reprodução permanece no motor HTML5 da TV, não libmpv. Seleção de faixas depende das APIs HTML5 expostas pelo hardware; não é emulação de libmpv. Não há migração integral de todos os recursos Windows, importação M3U/XMLTV nesta edição, pular abertura sem marcadores confiáveis ou distribuição por loja. Não classificar esta versão como todos os recursos da edição Windows ou produto final certificado.

## Evidência adicional 0.3.0

16 testes de domínio/persistência/cofre/contratos de reprodução, lint, IPK e smoke Chromium aprovados localmente. Smoke recarrega de fato a página, desbloqueia cifra, reconecta à fixture e verifica favoritos de canal e posições de filme/episódio. TextTrack é real no Chromium; contrato de audioTracks/reconexão usa mídia simulada no jsdom e não comprova mudança audível no aparelho. A primeira tentativa revelou que o servidor de QA sem Range fazia a posição voltar a zero; corrigido o servidor, busca e retomada passaram. O navegador não substitui o teste manual LG.

## Conexão, catálogo e Cinema 0.4.0

O proprietário forneceu exemplos no formato http:domínio e relatou formulário pulando usuário/senha, catálogo vazio e rejeição do visual anterior. Parser normaliza barras e mantém HTTPS; cadastro importa get.php/player_api.php, acesso embutido e URLs de transmissão Xtream reconhecidas. Extras de consulta são codificados, preservados nas requisições geradas e no cofre cifrado; parâmetros de ação não podem sobrescrever as ações internas. O parser de mídia continua restrito a HTTP(S), sem executar dados ou arquivos locais. Os domínios reais fornecidos não foram consultados nem incorporados a fixtures públicas.

Foco em formulários segue ordem DOM visível para ↑/↓, mantendo edição de texto por ←/→. Busca de catálogo vem antes de categorias para evitar bloqueio por endpoint opcional; envelopes conhecidos/mapas numéricos são normalizados sem aceitar respostas de erro como conteúdo. Falhas ganham mensagem e botão de nova tentativa; zero registros é distinguido de busca sem resultados. A causa da falha real do servidor permanece sem reprodução física/acesso autenticado.

UI muda de painel lateral/hero em cartão para navegação superior, fundo cinematográfico amplo, capas integradas ao destaque, imagem/sinopse do provedor quando disponíveis e acento laranja mantido. Scripts ES5, parsing DOM alternativo para URL e testes em 720p/1080p. Novas regressões: variações de esquema, cofre com parâmetros adicionais, foco de campos, HTTP 503 com retry, categorias HTTP 500 sem bloquear canal, catálogos em envelopes e mapas, fluxo após recarga sem window.URL.

### UHD solicitado no mesmo marco

Incluída amostra própria 3840×2160/24 fps, H.264 High 5.1 SDR e AAC, confirmada por ffprobe. Player mostra dimensões intrínsecas em loadedmetadata/resize/playing/timeupdate, sem rotular HD como UHD. URLs originais não são transcodificadas; HLS adaptativo continua sob controle nativo. Smoke exige avanço de tempo, dimensões 3840×2160 e quadros efetivamente apresentados, além do pacote. Isso comprova decodificação no Chromium, não painel/decoder físico LG.

Interface permanece no canvas lógico 1920×1080 conhecido; não trocar appinfo por 3840 sem validar suporte no aparelho. Portal LG não pôde ser consultado por bloqueio 403 do proxy; nenhum valor de manifesto ou API proprietária foi inventado. HDR, HEVC/Dolby e 4K de todas as fontes não estão certificados.

## 0.4.1 — compatibilidade visual e metadados opcionais

Foto real do usuário mostra catálogo comprimido à esquerda. CSS usava inset (não suportado por navegadores antigos), fundos hex com alpha e clamp. Substituídos por posicionamento explícito, rgba e tamanhos responsivos tradicionais. Hipótese compatível com foto; confirmação visual LG ainda necessária. Token TMDB fornecido pelo usuário não foi persistido nem incorporado. Integração configurável por sessão, ID prioritário/pesquisa conservadora, falha independente do IPTV. Sem acesso real TMDB no ambiente: rede configurada não inclui api.themoviedb.org. Testes contratuais não comprovam acesso físico.

## 0.4.2 — controle remoto, menu lateral e prévia

Pedido do proprietário: menu principal/subcategorias no mesmo painel, botões legíveis, imagem na prévia, canais por ↑/↓ em fullscreen, busca central e movimento suave. Implementado conforme descrição em platforms/webos-poc/README.md. Origem exata da prévia sem imagem na LG não reproduzida neste ambiente: HUD antes muito alto e clipping/composição são hipóteses; agora HUD compacto, plano sem recorte e tamanho explícito sincronizado. Não alegar teste físico com base em vídeo Chromium. Não alterar resolução lógica/URLs/codec para mascarar falhas. Setas de troca usam a coleção filtrada em memória, fecham sessão anterior antes de abrir outra e só atuam em TV fullscreen fora de diálogos. Movimento reduzido coberto; nenhum pacote de animação adicionado.

### Revisão posterior, ainda não enviada

Proprietário pediu busca no menu lateral (substitui posição central), rolagem suave sem fuga das setas para botões e elevação inequívoca da capa focada. Módulo navigation.js ES5 cuida de foco/scroll com animação de 200 ms e cancelamento; não depende de scroll-behavior/preventScroll nativos. Grade passa linhas/páginas na mesma coluna; episódios também. Na borda final mantém foco; esquerda dá acesso ao menu. Testes de navegador exercitam linhas, páginas e limites, além de preferências de movimento. Aguardando apresentação/revisão visual antes de publicar outro pacote.

### Revisão seguinte — banner, busca dedicada e Minha lista

Autorizado: foco atualiza banner com ações, busca abre tela dinâmica, retirar moldura/sublinhado do cartão e manter movimento curto. Minha lista adiciona mapa opcional de IDs validado/limitado a 4.000, mantendo schema público v1 compatível e separado de favoritos. Teste de persistência e isolamento entre contas acrescentado. Busca devolve snapshot do filtro/página e cancela processamento pendente para não substituir a grade depois que o usuário voltou. Testes reais de setas incluem banner correto em navegação rápida e seleção de ações. Design ainda aguarda revisão antes de envio à TV.

### Revisão do player solicitada pelo proprietário

Defeito: handler global retornava para INPUT nas setas laterais; range consumia navegação, sem acesso a outros controles. Correção: navegação explícita do player antecede o handler genérico; range só usa setas para seek no modo ativado por OK, com saídas por ↓/OK/Voltar. Toolbar separada do progresso e ajustes em painel lateral com foco próprio. HUD não some durante ajuste/painel; para no encerramento, e ao terminar mídia remove estados de edição antes do próximo episódio. Testar controle físico LG no marco manual; screenshots Chromium com mídia sintética servem à revisão do design.

## Entrega autorizada pelo proprietário

Pedido “Ok me traga o app para instalar” autoriza envio do conjunto webOS 0.4.2 revisado e geração do ZIP/IPK de desenvolvimento. Manter o app ID para preservar dados; não criar Release, publicar loja ou misturar alterações Windows pendentes. Confirmar CI e informar que o teste físico LG é o próximo marco.

### Adição solicitada durante a entrega

Proprietário pediu banner de cinema no login antes de receber o pacote. Incluída arte original local (geração de imagem; arquivo original em workspace/generated_images, cópia em app/assets/login-cinema.png), sem títulos reais ou indicação de catálogo fornecido. Sem credenciais TMDB embutidas ou acesso remoto obrigatório antes do login. Teste de imagem carregada acrescentado ao cenário Chromium.

## 0.4.3 — conflitos das setas e seleção de temporadas

Relato físico do proprietário: ↑/↓ trocavam canal antes de alcançar os controles; temporadas não recebiam foco. Correção: zap por setas somente com HUD oculto, comandos/botões próprios para troca explícita e controles com HUD aberto. Range usa limites seekable reais e fica desabilitado quando ausentes. Temporadas deixam select nativo e passam a botões com confirmação por OK, foco inicial após carregamento, caminhos explícitos hero↔temporadas↔episódios e rolagem horizontal ES5. Não altera URLs de reprodução, autenticação, histórico ou schema de persistência. Teste Chromium distingue a simulação de ausência de seekable do teste físico LG. Entrega continua sendo IPK de desenvolvimento.

## 0.4.4 — perfis locais, retomada e desempenho

Autorizado pelo proprietário: até cinco perfis locais após login, biblioteca/progresso individual; Continue separado em Filmes/Séries, sem TV; corrigir lupa; melhorar desempenho. Pedido adicional inclui banner da série com episódio/progresso/tempo restante e escolha de reiniciar/retomar.

Manifesto público de perfis por fingerprint da fonte/conta guarda somente ID local, nome escolhido e seleção. Perfil default mantém a chave original; os demais têm sufixo próprio. Credenciais não são duplicadas, permanecem no cofre existente. Nomes são textContent, até 24 caracteres, e arquivos/manifestos são limitados e validados. Falha de escrita impede a troca de perfil. Troca de perfil encerra a sessão de reprodução e limpa contexto de navegação/retomada, mantendo o catálogo público em cache.

Montagem de Continue indexada por série, sem varrer até 2.000 progressos para cada título. Carregamento visual com três imagens em voo, prioridade/visibilidade/cancelamento. Testes Chromium exercitam cinco perfis e confirmação de retomada; testes unitários cobrem dados antigos intactos, isolamento e gravação indisponível. Medições e limites em WEBOS_PERFORMANCE.md. Sem publicação em loja, teste físico ou promessa de FPS.


## 0.4.5 — controle, retomada confirmada e menus

Relato físico: retomada começou no início; controles da prévia só funcionavam com mouse. A antiga atribuição única de currentTime descartava o alvo mesmo sem duração ou confirmação. Novo controlador espera metadados/janela, confirma a posição por eventos, repete atribuições ignoradas e limita a espera a 20 segundos. Durante espera/falha pausa e bloqueia sobrescrita do progresso. Reproduzir tenta novamente; Do início é decisão explícita. Testes simulam duração indisponível e duas buscas ignoradas; não equivalem a aprovação do decoder LG.

Perfis redondos com gerenciamento separado, player em ícones e busca direta por setas na barra. Favoritos por tipo; Continue sem TV. Prévia acessível pelas setas/OK para ampliar, pausar e favoritar. TV mantém principais mais painel secundário; parent_id/parent_category_id fornecidos definem níveis, sem inventar agrupamentos pelos nomes. Voltar no catálogo leva o foco à categoria mãe; detalhes e player preservam retorno próprio. Menu de filmes/séries recolhe/expande sem alterar a geometria do catálogo. Sem dependências novas ou alterações no Windows.

Validação desta revisão: 32 testes unitários/contratos, ESLint, pacote IPK e cenário completo Chromium aprovados; cenário cobre prévia por setas/OK, filtros favoritos, painel hierárquico, cinco perfis, retomada com duração atrasada e duas buscas ignoradas. Verificação física LG pendente, inclusive confirmação da retomada real e imagem da prévia no plano nativo.


## 0.4.6 — identidade dos perfis e retorno às séries

12 ilustrações originais em sprite local, aplicadas em avatares circulares. Escolha e edição por controle; nomes e IDs de avatar limitados persistem no manifesto por fonte. Reset afeta preferências do perfil escolhido, mantém histórico/favoritos e não troca a fonte. Animação de entrada curta em opacity/transform com movimento reduzido respeitado. Perfil no topo fora do nav principal; transporte fullscreen centralizado, prévia preservada.

Home inclui “De volta às séries”: parentId de episódios e updatedAt reais determinam ordem, deduplicação por série e limite 12. Resolve arte/título somente no catálogo da fonte, carregado quando existe histórico; nenhum pedido de detalhes por episódio ou capa remota extra inventada. Outros perfis sem histórico não veem a faixa. Clique abre detalhes/retomada existentes.

Usuário autorizou retirar desbloqueio recorrente. Novo acesso automático usa chave AES-GCM não exportável via WebCrypto, clonada pelo IndexedDB junto de IV/cifra. A escolha protege contra credenciais legíveis no armazenamento; não impede alguém com acesso ao app/TV de abrir a lista e não é proteção por hardware garantida. No formato antigo é necessário desbloquear uma vez; só remover o cofre antigo depois de autenticar a fonte e persistir o novo acesso. Nenhum fallback em texto aberto. Desativação explícita em Configurações. TV física precisa confirmar suporte à persistência de CryptoKey e reabertura; Chromium não substitui esse gate.

Validação 0.4.6: 33 testes/contratos, ESLint, build IPK e regressão completa Chromium aprovados. Inclui transporte centralizado por geometria, 12 opções e posições distintas de avatar, Home carregada com faixa de histórico e isolamento, reabertura automática, chave não exportável e ausência de credenciais em localStorage, senha antiga incorreta e migração seguida de nova recarga. TV LG física continua pendente; ilustrações originais locais geradas, sem serviços de imagem no runtime.
