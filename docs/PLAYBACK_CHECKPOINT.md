# TV favorita, HUD funcional e capas — revisão atual

- TV: coração por canal, sem reproduzir ao favoritar; filtro Favoritos na própria TV. Estado salvo no SQLite existente e preservado ao atualizar a fonte. Consulta devolve indicadores em lote; não consulta favoritos individualmente ao carregar a lista. Filtrar/remover favorito não encerra o canal selecionado.
- HUD: causa identificada no código oficial do mpv — `input-default-bindings=no` desativava vínculos fracos do OSC e dos seletores, embora o desenho e bindings forçados funcionassem. Agora vínculos de scripts são habilitados e os atalhos builtin continuam desabilitados. Mouse habilitado explicitamente. Volume tem seletor percentual por clique e roda do mouse. Prazo nativo/fallback/cursor: cinco segundos. A prova Windows envia movimento/clique/roda para a janela real e verifica pausa/volume, sem chamar diretamente o callback do botão; teclado usa `keypress` real.
- Canais com áudio sem imagem: modo de compatibilidade em Ajustes (interface e HUD nativo), alternando decodificação por hardware/software sem adicionar outra conexão à fonte. É uma opção de diagnóstico/recuperação; causa dos canais do provedor ainda não confirmada. Pode aumentar uso de CPU.
- Capas: removido bloqueio global durante rede/processamento. Até quatro downloads e dois processamentos simultâneos, deduplicação por chave, cache hits independentes, quota de disco preservada. Prazo total de rede por capa: 12 s. Derivados limitados a 1600 px, JPEG qualidade 88 quando opacos, PNG com transparência. Frontend compartilha pedidos e mantém LRU de 12 MiB/64 capas por até um minuto; destaques têm prioridade e antecipação de carregamento. URLs/credenciais continuam somente no backend; mesmas restrições de HTTPS, endereço público, TLS, tamanho e dimensões.

## Validação local

37 testes frontend, 15 cenários de navegação, 29 testes Rust do núcleo/HTTP, tipos/lint/Clippy/build Vite aprovados. Cenários novos verificam favoritar sem tocar, filtrar mantendo vídeo, dados persistidos/refresh tipado, memória/deduplicação/expiração de capas e operação de compatibilidade.

Teste controlado de seis imagens com atraso simulado de 120 ms cada: paralelo 262 ms, sequencial 761 ms, pico de quatro downloads. A comparação usa mesma normalização e isola serialização; não mede CDN/provedor real. Cache hit não aguardou download lento; solicitações simultâneas da mesma capa baixaram uma única vez. [Medição](benchmarks/artwork-cache-2026-10-25.json).

CI Windows/pacote desta revisão em validação. Confirmar no PC os canais afetados, cliques/volume, compatibilidade e velocidade real das capas. Não declarar os canais sem vídeo resolvidos sem evidência com a fonte real.

---

## Marco anterior — histórico

# Tela cheia — controles por inatividade

Pedido: Voltar e controles de reprodução só devem aparecer durante interação e desaparecer após cerca de três segundos.

- Cabeçalho e controles em tela cheia são desenhados pelo próprio player sobre o vídeo, sem faixa HTML fixa. Inclui Voltar, Ajustes, Sair da tela cheia e Episódios quando há temporadas.
- Movimento do mouse sobre vídeo nativo, clique ou teclas reativam os controles. Três segundos sem interação ocultam cabeçalho/OSC, inclusive pausado. Cursor do motor segue prazo de três segundos.
- Ao sair, navegação normal é restaurada. Painéis da interface e erros permanecem acessíveis. Nenhuma dependência, fonte ou configuração de armazenamento adicionada.

Validação local: 35 testes frontend, TypeScript/lint/build Vite aprovados; 14 cenários Playwright cobrem ocultação, mouse, teclado, painel e regressão. Sintaxe Lua verificada. A prova gráfica Windows foi ampliada para conferir visibilidade do HUD, desaparecimento enquanto pausado e reativação por binding de teclado. [CI Windows/web/core](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40198382897) com os gates aprovados em 25/10/2026 para `bae77c939960f0e35dcd62cf1786630c8dfc1645`: quatro provas libmpv, incluindo o teste gráfico ampliado, Clippy, fmt, Rust/DPAPI e build Tauri.

[Pacote NOVA-PLAYER-Windows-x64-test](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40198382897/artifacts/12601015641), ID `12601015641`, 82,5 MB; SHA-256 do ZIP `28e4852ca94b819226b93ad0ec5436ea817393d360be8e105eed39b8b1f97afd`. Extração completa inclui o novo script HUD. O primeiro gate identificou que `user-data` é retornado como JSON pela API string; o teste foi corrigido para decodificar esse formato, mantendo as asserções de visibilidade/prazo/teclado. Não houve remoção de testes ou alteração dos limites de rede/TLS. Commits posteriores somente de documentação não alteram o pacote. No PC, confirmar mouse sobre o vídeo, botões nativos, pausa, DPI e saída/retorno com a Horizon.

---

## Marco anterior — histórico

# Menu de categorias e busca global — revisão atual

- Filmes e Séries substituem o conteúdo do mesmo menu lateral pelas subcategorias da fonte. Retorno ao menu principal mantém o catálogo atual; Início leva diretamente à home. Há filtro de categorias, estados de carregamento/erro/repetição e mensagem quando a fonte não fornece categorias. Seleção destaca a categoria e consulta o backend paginado; filtros de filmes/séries são independentes. Não são criadas categorias fictícias.
- Expandir/recolher preserva seleção. No modo compacto, ícones de retorno, Início e expansão substituem uma coluna de tags indistinguíveis. Teclado e rolagem sem barras preservados; retorno restaura foco na seção do menu.
- Busca global maior, com ícone destacado e indicação Filmes/séries/canais, acessível por clique/Ctrl+K. Ao buscar durante prévia, a superfície nativa é ocultada para não cobrir o diálogo, sem parar/reabrir o stream. Fechar restaura a prévia; escolher filme/série encerra a TV e abre detalhes.

Validação local: 32 testes de unidade/componentes, 13 cenários Playwright, tipos/lint/build Vite aprovados. Backend, esquema, motor nativo e dependências Rust permanecem os do marco anterior. [CI web/core/Windows](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40195802312) aprovada em 25/10/2026 para o código `21f47a3411fe72f5079eb2f4f2439fbbfcc5e226`: quatro provas libmpv, suíte Rust/DPAPI, Clippy e build Tauri aprovados.

Pacote [NOVA-PLAYER-Windows-x64-test](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40195802312/artifacts/12599836666), 82,5 MB, ID `12599836666`. SHA-256 do ZIP: `f300b8cfcb01b9b0fe9f45df51b785fe4e7963e59e190b9ed01402d16df54360`. Extrair todo o ZIP, preservando DLL e HUD ao lado do exe. O pacote anterior abaixo é histórico. Commits posteriores de documentação não alteram este executável. Teste de mouse/foco/diálogo sobre WebView+HWND com Horizon no PC permanece manual.

[Captura do menu com dados sintéticos](screenshots/nova-category-menu-fixture.png).

---

## Marco anterior — histórico

# NOVA Library — navegação contextual

Pedido autorizado: catálogo cinematográfico em TV/filmes/séries, menu com ícones e texto quando expandido, rolagem funcional sem barras, detalhes próprios e episódios visuais. A composição integrada anterior foi aprovada visualmente pelo proprietário.

## Implementado nesta revisão

- TV: categorias, lista de canais e vídeo lado a lado. Primeiro clique reproduz na prévia; segundo clique no mesmo canal amplia a mesma sessão, sem novo `play_media`. Voltar restaura a prévia. Escolher outro canal substitui o stream; sair da TV encerra a prévia. Não abre streams paralelos para preencher cartões.
- Filmes: página de detalhes com metadados disponíveis, favoritar, Minha Lista, assistir, continuar ou começar do início.
- Séries: página completa com destaque, sinopse, seletor de temporada, cartões 16:9, título/duração/sinopse fornecidos. Clicar no episódio reproduz; voltar preserva a temporada. Imagem da fonte tem preferência; na ausência, captura real de um frame sem áudio, em fila limitada e com cancelamento prioritário para a reprodução. Placeholder explícito quando indisponível.
- Favoritos, Minha Lista e progresso persistidos no SQLite. Migração 002 transacional conserva o catálogo; testes exercitam reabertura, atualização de fonte e limpeza na remoção. TV ao vivo não recebe retomada.
- Nenhuma dependência nova; URLs/credenciais permanecem no Rust. Cache de frames: 64 MiB/sete dias. Barra lateral funciona recolhida/expandida; scroll e teclado continuam disponíveis.

## Evidência da revisão

Validação local: TypeScript, ESLint, 32 testes de componentes/unidade, build Vite e 26 testes Rust sem WebView aprovados. 11 cenários Playwright aprovados, incluindo os fluxos novos. [CI Windows/web/core](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40193987175) aprovada em 25/10/2026 para o código `f33cd56b90f7ddbc684918d89ffd1af3c63ba271`. Os quatro testes explícitos libmpv (incluindo captura real sem áudio e início na posição solicitada), fmt, Clippy, suíte Rust/DPAPI e build Tauri passaram.

Artefato [NOVA-PLAYER-Windows-x64-test](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40193987175/artifacts/12599217378), ID `12599217378`, 82,5 MB, SHA-256 do ZIP `d489c1c8ca350fcaab3440a452f6a4a478c080d6897f3272abac48c741a9c831`. Inclui exe, DLL, HUD, avisos e distribuição original do motor. Commits posteriores somente de documentação não mudam o executável. A captura `docs/screenshots/nova-series-page-fixture.png` é da interface real com fixture explicitamente sintética; não demonstra reprodução nativa.

Pendente: teste manual da Horizon com os novos fluxos, imagens de episódios, prévia lateral/retorno, áudio, DPI e retomada após fechar/reabrir o aplicativo. A prova de retomada cobre posição inicial do motor e persistência no núcleo separadamente; não é automação ponta a ponta do WebView Windows. Não interpretar teste Chromium com IPC controlado como transmissão real. Sem instalador ou Release.

---

## Marco anterior — histórico

# NOVA Cinema — player na mesma janela

Marco autorizado pelo proprietário após confirmar reprodução da Horizon na versão anterior. Referências visuais fornecidas pelo proprietário orientam hierarquia, destaque e fileiras; a identidade permanece NOVA.

## Experiência implementada

- Biblioteca real com destaque amplo, pôsteres em fileiras, navegação compacta e ações Assistir/Mais informações. Metadados e imagens somente da fonte; a captura em docs/screenshots/nova-cinema-fixture.png está identificada como dados sintéticos.
- Clique no canal ou filme inicia a reprodução; séries abrem temporadas e episódios, e clicar no episódio inicia. Voltar restaura a série e a temporada selecionada. Busca real também oferece o acesso direto.
- Vídeo em HWND filho do aplicativo. React mantém cabeçalho, ajustes e painel de episódios fora da superfície; o HUD é desenhado pelo OSC no próprio vídeo, evitando disputa de sobreposição com WebView2.
- Script local `nova-hud.lua` fornece menus de velocidade/áudio/legendas e atalhos fixos. Ele é incluído no pacote e carregado de caminho controlado; configuração, scripts automáticos e logs externos continuam desativados. O nome interno normalizado pelo mpv é `nova_hud`.
- HUD com progresso, play/pause, volume, seek quando suportado, ajustes, velocidade e ação de tela cheia na janela Tauri. Controles acessíveis React ficam disponíveis por teclado; HUD desaparece automaticamente em reprodução e permanece quando pausado. Esc, espaço, setas, M e F têm comportamento próprio para foco no vídeo ou na interface.
- ResizeObserver e coordenadas físicas ajustam a superfície; criação/reposicionamento HWND ocorrem na thread da janela. Montagem, troca e fechamento são serializados para evitar dupla abertura no StrictMode e corridas entre episódios. Nenhum fallback silencioso para janela externa.

## Evidências desta revisão

Código funcional: `94bd633003c50b4e98b556bff0ce2e259da13840`.
[CI final Windows/web/core](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40165447010) aprovada em 25/10/2026. Os três testes explícitos de reprodução, fmt, Clippy, Rust Windows/DPAPI, TypeScript, ESLint, 32 testes frontend, 8 cenários de navegação e build Tauri passaram. Artefato `NOVA-PLAYER-Windows-x64-test`, ID `12588251735`, 82,4 MB; SHA-256 do ZIP `b5800333e59516b021610d825a3e2cf6b231090ef6010b0dc2905bc1f5b30daa`. Pacote inclui exe, DLL, script HUD, captura gráfica de teste e avisos. Commits posteriores de documentação não alteram esse executável.

A última falha de conexão foi isolada no servidor de fixtures: leitura parcial dos headers TCP e necessidade de definir explicitamente modo bloqueante nos sockets aceitos no Windows. O servidor foi corrigido sem remover testes ou repetir automaticamente uma asserção que falhou. Fixtures de decodificação usam software, enquanto a prova gráfica mantém renderer real; configuração de hardware da aplicação permanece `auto-safe`.

Local: TypeScript, ESLint, 32 testes frontend e build Vite aprovados; 8 cenários Playwright aprovados, incluindo biblioteca com fixtures, um clique, pausa por espaço, retorno à temporada e ausência de tráfego remoto na prévia. Os 24 testes do núcleo Rust passam no Linux sem WebView.

A prova Windows possui três testes explícitos: decodificação/controles/HLS e bloqueio de arquivo local; Xtream → SQLite/DPAPI → canal/filme/episódio → decodificação; e HWND filho com saída gráfica real, Lua/OSC ativo, resize, ação de teclado encaminhada ao aplicativo e captura PNG com diversidade de pixels de vídeo. A prova gráfica usa janela de teste nativa; não equivale a teste manual da janela Tauri no computador do proprietário. Áudio da prova gráfica é desativado; decodificação de áudio permanece coberta pelos outros gates.

Ainda requer teste no PC: composição WebView/vídeo com a Horizon real, áudio audível na nova composição, foco/mouse do HUD, menus, tela cheia, DPI 100/150/200%, troca de monitores e ciclos de abrir/voltar. Não há promessa de compatibilidade universal.

## Histórico do primeiro marco de reprodução


Autorizado pelo proprietário: reprodução nativa e áudio; licença GPL versão 3 ou posterior. Não inclui instalador, publicação ou Release.

## Decisão

PoC isolada em teste Windows antes do build integrado. libmpv usa janela própria com controles React separados. A decisão evita depender de composição de vídeo com WebView2 ainda não comprovada. Não é a integração visual definitiva. Saídas de produção explícitas: `gpu-next,gpu` para janela de vídeo, WASAPI compartilhado para áudio do Windows; a PoC usa `null` e não valida esses dispositivos. Uma thread possui DLL e handle; fila limitada, estado consultado sem URLs, teardown explícito. DLL somente no diretório do executável, dependências somente nesse diretório e System32. Sem busca no PATH ou diretório de trabalho.

A UI usa IDs internos; o backend consulta SQLite, valida o escopo de episódios, descriptografa via DPAPI e só então abre HTTP/HTTPS no motor. Configuração e scripts externos, carregamento automático de legendas/áudio local, ytdl e logs do motor desativados; TLS permanece verificado. Referências de rede necessárias ao HLS permitidas; protocolos aninhados limitados a rede/dados/cripto, excluindo `file`. `load-unsafe-playlists=no` mantém a proteção de playlists mpv. A PoC inclui HLS remoto que tenta referenciar um segmento válido no disco e deve falhar. Arquivos M3U locais continuam sendo catálogos, não abertura arbitrária de mídia local.

Controles: abrir/substituir conteúdo, pausa, parar, volume 0–100, mudo, velocidade 0,25–2, seek somente quando o motor informa suporte, seleção de áudio e legendas da fonte e tela cheia. Reconexão automática, histórico/retomada, buffer local/timeshift e integração embutida ainda não estão implementados.

## Xtream

Correção comprovada por servidor HTTP local: URL explícita `player_api.php` antes duplicava o endpoint; agora compartilha base normalizada com rotas de streams. Prefixos de servidor e encoding de credenciais preservados. Mensagens de formato de provedor e redirect recebem tradução segura. Não há evidência de que esse era o endereço usado pelo proprietário; importar no provedor real segue pendente.

## Gate

A PoC CI usa AVI sintético (vídeo raw/áudio PCM), HLS MPEG-2/AAC servido por HTTP local e MP4 H.264/AAC. Um segundo teste cobre Xtream → SQLite/DPAPI → resolução de canal/filme/episódio → decodificação em libmpv. O teste negativo HLS é servido de fato e aponta a um segmento local válido, que deve ser bloqueado. Saídas nulas testam decodificação sem requerer dispositivo de áudio da máquina hospedada. Teste manual permanece obrigatório para imagem visível/som audível, fullscreen, teclado, GPU, ciclo de janela, HLS do provedor e serviço real. Revisão funcional `7892e23be0f8d4be294cb03e929cdb6e3b3eaaba`: [execução Windows/web/core aprovada](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40161854232), em 25/10/2026. Os dois testes PoC passaram; fmt, Clippy, suíte Rust Windows/DPAPI, TypeScript, lint, 32 testes de frontend, 6 testes de navegação e build Tauri Windows passaram. Artefato `NOVA-PLAYER-Windows-x64-test`, ID `12586348139`, 82 MB, SHA-256 do ZIP `c034e45d48f114a98db878803e7b53d41350a41ef5a831dba7e5c029a35d1301`. Não houve instalador ou Release. Os commits posteriores de documentação não mudam o código desse artefato.

Binário de teste preserva a distribuição original de libmpv e os avisos. Revisão de fontes/licenças transitivas é necessária antes de distribuição pública; veja THIRD_PARTY_NOTICES.md.
