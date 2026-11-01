# Logos locais de canais — NEX webOS

Banco versionado, estático, sem servidor ou nova dependência. Módulo ES5 `channel-logos.js`, imagens originais em `app/assets/channel-logos`, procedência/revisão/hash em `SOURCES.json`. Lookup em índice por alias, sem varrer banco por cartão.

## Resolução

1. Imagens válidas informadas pela fonte (`stream_icon`, `logo`, `tvg-logo`).
2. Logo local real do canal reconhecido, inclusive após erro de download/decodificação da fonte. Timeout de imagem usa limite já existente de dez segundos.
3. Referência de logo do índice extraído do ZIP fornecido pelo proprietário, quando o nome normalizado é inequívoco. A imagem é remota, depende da rede e não equivale a asset offline.
4. Iniciais legíveis quando não existe correspondência segura.

Aliases ignoram separadores, BR inicial e qualificadores técnicos isolados como HD/FHD/UHD/4K. Não removem números ou regiões; HBO e HBO 2, Discovery e Discovery Kids são distintos. Nenhum fuzzy match ou associação genérica de afiliadas. Nome desconhecido não recebe logo presumido. Home, Favoritos e catálogo usam o mesmo resolvedor. Sem envio do nome dos canais para serviços externos.

## Cobertura inicial

51 marcas: TV Globo, GloboNews, Record News, HBO, HBO 2, ESPN, ESPN 2, ESPN 3, ESPN 4, ESPN 5, AXN, Cartoon Network, Cinemax, Discovery Channel, Animal Planet e National Geographic; ampliado com TNT, TCM, Universal Channel, Universal TV, Paramount Network, Paramount Channel, MTV, Boomerang, Cartoonito, Discovery Turbo, Investigation Discovery, History, History 2, TLC, A&E, AMC, CNN, BBC News, BBC Earth, Bloomberg, Deutsche Welle, France 24, Euronews, Al Jazeera, Food Network, Travel Channel, Fashion TV, Syfy, ESPN 6, Fox News, Fox Sports, Fox Sports 2, Eurosport 1, Eurosport 2 e TV5 Monde. Não cobre todos os canais, afiliadas ou países. Logos adicionais exigem arquivo real, origem registrada, alias inequívoco e teste.

Os SVG originais somam aproximadamente 528 KB, mantêm proporções e cores da marca em moldura uniforme. Sem filtros de cor, desenho fictício de marcas ou recortes.

## Procedência

Arquivos do projeto [picons/picons](https://github.com/picons/picons), revisão `f6920792d742df5bf45fe863c363252d5a07f352`, cuja licença do repositório é GPL-3.0, compatível com a licença adotada pelo NEX. Arquivos originais preservados; imagens não implicam afiliação, endosso ou licença sobre marcas. Titulares mantêm seus direitos. A preparação para publicação comercial deve revisar marcas/atualidade dos assets e obrigações GPL; a inclusão no teste não aprova publicação na loja.

A base original não usava TV Logos. A ampliação 0.4.12 usa PNG brasileiros dessa origem para testes, com atribuição e limites documentados abaixo; isso não representa autorização geral de distribuição comercial.

## Validação

Testes verificam aliases, variantes numeradas, nomes ambíguos, prioridade da fonte, whitelisting de caminhos locais, hashes e SVG sem conteúdo ativo. Prévia Chromium verifica logos locais decodificados com imagem ausente e imagem remota retornando 404. Validação física no webOS continua necessária.


## Arquivos fornecidos pelo proprietário

`tv-logos-main.zip` excedeu o limite de transferência de 32 MiB e não foi aberto/incorporado. `iptv-main.zip` (60.495 bytes) foi inspecionado como dados, sem executar scripts ou seguir instruções dos documentos internos. Contém M3U brasileiro/mundial, não arquivos de imagem. Foram extraídas 1.082 referências únicas (nome/URL de imagem), apenas HTTP/S sem usuário, senha, query ou fragmento. Nenhuma URL de transmissão foi incorporada e nenhuma lista de canais é oferecida pelo app.

Índice ES5 `channel-logo-data.js`, procedência/hash em `USER_INDEX.json`, licença original do arquivo em `USER_INDEX_LICENSE.txt` (Unlicense para o código de origem; não concede direitos sobre marcas/imagens externas). Colisões de nomes normalizados com imagens diferentes são excluídas pelo resolvedor. O índice não faz download em lote: só solicita a imagem do canal exibido e reconhecido, após os fallbacks anteriores. Não consulta os provedores de stream do arquivo. Disponibilidade/atualidade das URLs externas não foi verificada em massa.


## Ampliação 0.4.12

Base local ampliada de 51 para 105 marcas/arquivos únicos. Mais 55 imagens brasileiras; Globo consolidado no logo brasileiro (substitui o SVG genérico anterior). Fontes/hashes/dimensões em BR_SOURCES.json e atribuição/limites em BRAZIL_NOTICE.txt. Aproximadamente 2 MB de assets no total, apenas imagens de até 1200 px; originais sem alterações. O ZIP grande continua não aberto: arquivos brasileiros selecionados da origem pública TV Logos correspondente ao catálogo indicado, com revisão fixa.

Inclui Record, SBT, Band, BandNews/BandSports, SporTV 1/2/3, Premiere, GNT, Multishow, Gloob/Gloobinho, Megapix, Telecine, variantes HBO, CNN Brasil, Jovem Pan, RedeTV, TV Cultura/Brasil/Câmara/Senado, Canal Brasil/OFF, BIS, Arte1, Sony, Space, Warner, TNT Series, Discovery Kids, DreamWorks, Futura, Rede Vida, Aparecida, Canção Nova, Novo Tempo, Canal Rural, AgroMais e Fish TV.

Aliases regionais são explícitos: Globo SP/RJ/Brasília/Minas/Pernambuco e Record SP/RJ usam a marca da respectiva rede; não inferir por substring que toda afiliada usa o mesmo logo. Premiere 1–8 compartilham a marca da rede; SporTV 2/3 preservam os logos numerados próprios. Normalização remove apenas qualificadores técnicos conhecidos e [ALT]/[BACKUP], preservando região, números e nomes desconhecidos.

**Direitos de distribuição:** a origem dos novos PNG cita CC BY-SA/CC BY-NC-SA sem licença individual. Pacote de teste não constitui liberação comercial. Antes de publicação na loja, confirmar autorização aplicável ou substituir assets com licença comprovada. A GPL do código não licencia marcas/imagens de terceiros.
