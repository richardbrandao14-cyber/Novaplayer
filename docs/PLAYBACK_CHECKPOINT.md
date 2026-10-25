# Player Windows — checkpoint de desenvolvimento

Autorizado pelo proprietário: reprodução nativa e áudio; licença GPL versão 3 ou posterior. Não inclui instalador, publicação ou Release.

## Decisão

PoC isolada em teste Windows antes do build integrado. libmpv usa janela própria com controles React separados. A decisão evita depender de composição de vídeo com WebView2 ainda não comprovada. Não é a integração visual definitiva. Uma thread possui DLL e handle; fila limitada, estado consultado sem URLs, teardown explícito. DLL somente no diretório do executável, dependências somente nesse diretório e System32. Sem busca no PATH ou diretório de trabalho.

A UI usa IDs internos; o backend consulta SQLite, valida o escopo de episódios, descriptografa via DPAPI e só então abre HTTP/HTTPS no motor. Configuração e scripts externos, carregamento automático de legendas/áudio local, ytdl e logs do motor desativados; TLS permanece verificado. Protocolos de mídia limitados; referências locais bloqueadas para fontes remotas. Arquivos M3U locais continuam sendo catálogos, não abertura arbitrária de mídia local.

Controles: abrir/substituir conteúdo, pausa, parar, volume 0–100, mudo, velocidade 0,25–2, seek somente quando o motor informa suporte, seleção de áudio e legendas da fonte e tela cheia. Reconexão automática, histórico/retomada, buffer local/timeshift e integração embutida ainda não estão implementados.

## Xtream

Correção comprovada por servidor HTTP local: URL explícita `player_api.php` antes duplicava o endpoint; agora compartilha base normalizada com rotas de streams. Prefixos de servidor e encoding de credenciais preservados. Mensagens de formato de provedor e redirect recebem tradução segura. Não há evidência de que esse era o endereço usado pelo proprietário; importar no provedor real segue pendente.

## Gate

A PoC CI usa AVI sintético (vídeo raw/áudio PCM) e HLS MPEG-2/AAC servido por HTTP local. Saídas nulas testam decodificação sem requerer dispositivo de áudio da máquina hospedada. Teste manual permanece obrigatório para imagem visível/som audível, fullscreen, teclado, GPU, ciclo de janela, HLS do provedor e serviço real. O resultado CI será registrado após execução; não considerar escrito como aprovado.

Binário de teste preserva a distribuição original de libmpv e os avisos. Revisão de fontes/licenças transitivas é necessária antes de distribuição pública; veja THIRD_PARTY_NOTICES.md.
