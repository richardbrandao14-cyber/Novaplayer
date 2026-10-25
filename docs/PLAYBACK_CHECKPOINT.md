> Novo marco em desenvolvimento: usuário confirmou a versão anterior funcionando com Horizon. Autorizou vídeo na mesma janela, HUD durante reprodução, acesso com um clique e visual inspirado nas referências de streaming. Superfície HWND filha do aplicativo + OSC embutido e script NOVA HUD controlado, sem WebView sobreposto ao vídeo. Gate gráfico Windows novo exige reprodução no HWND filho, script carregado, OSC ativo e captura da superfície. Resultado ainda pendente nesta revisão.

# Player Windows — checkpoint de desenvolvimento

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
