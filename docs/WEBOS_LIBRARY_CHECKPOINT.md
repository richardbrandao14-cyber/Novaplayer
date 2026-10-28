# NEX webOS 0.2.0 — biblioteca de uso

## Escopo e evidências

O proprietário autorizou evoluir a PoC para a biblioteca webOS após confirmar interface, vídeo/som locais e teste de canais da fonte real na LG UM7510PSB (firmware 05.40.97). Filmes e séries reais na LG ainda não foram confirmados. Não é publicação em loja, instalador Windows nem certificação de produção.

Implementação isolada em `platforms/webos-poc`. Código ES5, sem dependências de execução remotas; CSS e scripts embutidos com hashes CSP. Windows e suas alterações em andamento foram preservados.

## Comportamento

- Cadastro aceita servidor HTTP, HTTPS, domínio/IP com porta e caminho; sem esquema assume HTTP. Esquema explícito é preservado, HTTPS não sofre downgrade automático. Xtream usa HTTP(S); arquivos locais, JavaScript, FTP e credenciais embutidas no domínio continuam rejeitados. URLs com query não são tratadas como endereço-base de servidor.
- Após autenticação: navegação Início, TV ao vivo, Filmes, Séries, Favoritos e Minha fonte. Home usa filmes reais da fonte, sem alegar popularidade ou recomendação.
- Categorias reais, busca na seção inteira e paginação de 48 cartões. Todos os registros recebidos ficam disponíveis; não existe corte em 40. Filtro em blocos de mil registros com cancelamento. Continua existindo limite de segurança de 32 MiB por resposta e timeout de 30 s. JSON é processado no navegador; consumo e fluidez na TV real não foram medidos.
- Filmes abrem detalhes antes de reproduzir, consultando `get_vod_info`. Série usa `get_series_info`, seletor de temporada e 24 episódios por página, título e imagem quando fornecidos. Próximo episódio por botão, atravessando temporadas na ordem fornecida. Sem trailer inventado, extração de frames ou pular abertura sem marcadores.
- Canal abre em prévia lateral. Segundo clique ou botão amplia a mesma sessão. Voltar da tela cheia ao vivo retorna à prévia; outro Voltar fecha. Catálogo/busca continuam disponíveis durante a prévia.
- Voltar curto (461/Escape) é consumido em todas as telas. Histórico interno limitado a oito contextos, preservando filtro/página/temporada; início não chama saída do app. `disableBackHistoryAPI: true` evita o tratamento padrão do histórico webOS. Tecla física e eventuais ações reservadas do sistema exigem validação LG.
- HUD funcional: pausa, busca quando suportada, velocidade, tempo e próximo episódio. Some após cinco segundos; interação o revela. Primeiro OK com HUD oculto apenas revela, evitando pausa acidental. Volume pelo controle da TV.
- Favoritos por tipo, incluindo canal, e progresso de filmes/episódios somente na sessão. Credenciais, URLs e metadados não são gravados no armazenamento web. Ao desconectar/encerrar, sessão é limpa; reconectar requer acesso novamente.

## Verificação

Executar os testes documentados em `platforms/webos-poc/README.md`. Regressões incluem sintaxe ES5, URLs com/sem esquema, preservação de HTTPS/credenciais codificadas, catálogo com 50 mil registros, busca do último item, categoria, paginação, filme/detalhes, favorito de canal, episódio/temporada/próximo, reprodução MP4 sintética, HUD e retorno LG cancelável. Verificação de imagens remotas exige `naturalWidth > 0`, pois a revisão encontrou CSP que as bloqueava. Capturas contêm apenas obras e arte sintéticas identificadas.

Limites: navegador Chromium não certifica codecs, áudio audível, CORS/TLS do provedor nem funcionamento físico do Voltar. A reprodução permanece no motor HTML5 da TV, não libmpv. EPG, faixas alternativas/legendas, favoritos/progresso duráveis, reconexão automática avançada e instalação por loja não estão implementados nesta entrega. Não classificar esta versão como todos os recursos da edição Windows ou produto final certificado.
