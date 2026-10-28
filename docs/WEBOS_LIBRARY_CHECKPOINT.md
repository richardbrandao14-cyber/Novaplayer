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
