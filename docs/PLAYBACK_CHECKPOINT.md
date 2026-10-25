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
