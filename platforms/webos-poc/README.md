# NEX para LG webOS — 0.4.8

Edição de uso com fontes Xtream autorizadas. Alvo do proprietário: LG UM7510PSB, firmware 05.40.97. Canais reais e amostras locais de vídeo/áudio foram confirmados na versão anterior; esta atualização ainda precisa da confirmação física. Não fornece conteúdo, assinatura ou transcodificação.

## Atualizar sem programar

Feche NEX na TV, extraia o ZIP e instale `com.nex.poc.webos_0.4.8_all.ipk` pelo **Install** do Dev Manager. Abra **NEX**. Não desinstale a cada atualização: uma atualização do mesmo ID preserva o armazenamento local; desinstalar pode removê-lo.

O pacote leve não inclui vídeos HD/4K/HLS nem ferramentas de teste visíveis. Se o Dev Manager mostrar **Timeout**, feche NEX, confirme que Developer Mode/Key Server estão ativos na TV e reconecte o gerenciador antes de tentar instalar este IPK menor. Não desinstale para tentar resolver: isso pode apagar o histórico. Timeout também pode vir da conexão; tamanho menor não garante resolver sua causa.

## Usar

- Cadastre servidor, usuário e senha. Aceita `http:servidor`, `https:servidor`, HTTP/HTTPS completos, `servidor:porta` e links completos Xtream; sem prefixo assume HTTP. Prefixos com barras ausentes são normalizados e HTTPS explícito não sofre downgrade. Links get.php/player_api.php podem fornecer usuário e senha; parâmetros adicionais são preservados nas consultas e cifrados no cofre. Xtream não usa protocolos arbitrários.
- Marque **Entrar automaticamente neste aparelho** para abrir diretamente nos perfis. O acesso é cifrado com AES-GCM e uma CryptoKey não exportável guardada no IndexedDB do app. Isso permite que quem usa a TV abra sua lista; não é proteção por PIN nem garantia de um cofre do sistema operacional. O acesso antigo exige a senha uma última vez. A migração só termina depois de reabrir o banco e decifrar os dados salvos; se falhar, os perfis mostram um aviso com **Tentar salvar a sessão** (↑ a partir dos perfis), preservando o cofre antigo. Enquanto o acesso automático é carregado, a senha permanece oculta. Se WebCrypto/IndexedDB falhar, o app não grava credenciais em texto aberto e informa a limitação. Em Configurações, **Desativar entrada automática** remove o acesso salvo.
- Perfis: 12 avatares locais originais. Gerenciar perfis permite escolher a imagem, editar nome e restaurar preferências sem apagar favoritos/histórico. O perfil fica separado no topo do menu.
- Início traz **Novidades**, **Filmes**, **Séries** e **Ao vivo agora**, em fileiras limitadas e navegáveis pelo controle; os catálogos completos continuam nas seções. Novidades usa datas reais de inclusão da fonte, não data de lançamento nem popularidade. Ao vivo agora lista canais disponíveis, sem inventar programação.
- Início mantém **De volta às séries**, ordenado pelo histórico do perfil, até 12 séries disponíveis na fonte. Sem histórico, a faixa fica oculta.
- Início, TV ao vivo, Filmes e Séries usam somente o conteúdo da sua fonte. Busca na seção completa, categorias e páginas substituem o antigo corte em 40 registros.
- Favoritos: filtros Todos, Filmes, Séries e TV ao vivo; Continue mantém somente filmes e séries.
- TV, Filmes e Séries mantêm navegação principal e painel de categorias ao lado; grupos derivados substituem o painel quando a fonte fornece relação de parentesco. Em filmes e séries, o menu recolhe aos ícones e expande ao voltar para ele. Voltar no catálogo foca sua categoria principal.
- TV: → na última coluna de canais alcança Tela cheia; ↓ acessa pausa e favorito; ← retorna aos canais. Primeiro clique abre prévia; segundo amplia. Voltar retorna à prévia e depois ao catálogo. **Programação** consulta o EPG oferecido pelo provedor sem parar o vídeo.
- Filme abre detalhes; série abre temporadas e episódios com as imagens fornecidas. **Continuar assistindo** e **Favoritos** sobrevivem ao fechamento, separados por lista.
- O próximo episódio começa após contagem de dez segundos ao terminar. **Cancelar** interrompe a contagem; a preferência fica em **Configurações**.
- Qualidade: URL original da fonte, incluindo 4K compatível, sem transcodificação no aplicativo. O HUD mostra as dimensões reportadas pelo player. O motor nativo de HLS pode adaptar a variante à conexão. Amostras 4K/HD/HLS ficam somente no ambiente de QA; não acompanham o pacote leve instalado na TV.
- Player: retroceder, reproduzir/pausar, avançar e configurações em ícones. Na barra de progresso, ←/→ ajustam diretamente dez segundos; ↓ retorna aos controles. Retomada aguarda confirmação da posição, tenta novamente se o decoder ignorar o primeiro avanço e preserva o progresso salvo se falhar; não começa do zero silenciosamente. Pausa, posição quando a fonte permite busca, velocidade, reiniciar, próximo episódio, áudio/legendas quando expostos pela TV. O volume usa o controle da TV. HUD some após cinco segundos e reaparece com interação.
- Falha de rede: até três tentativas automáticas, com espera crescente e botão para tentar novamente. Erro de codec não cria loop automático.
- Configurações permite atualizar catálogo, escolher HLS/MPEG-TS e apagar favoritos/progresso da lista com confirmação. **Minha fonte** troca ou desconecta o acesso; **Esquecer acesso salvo** remove o cofre sem apagar a biblioteca.

Favoritos e progresso armazenam IDs/posições, não URLs, capas, senhas ou dados do servidor. O formato antigo do cofre contém cifra autenticada AES-GCM, sal e IV; sua senha de desbloqueio não é armazenada. O novo acesso automático contém cifra/IV e chave não exportável no IndexedDB, removível em Configurações. Histórico e favoritos não são sincronizados com outros aparelhos.

## Instalação na TV — sem programação

1. Na LG, abra **LG Content Store**, procure **Developer Mode** e instale o app publicado pela **LG Electronics**. A disponibilidade pode variar conforme a região/loja.
2. No computador, crie/ative uma conta de desenvolvedor LG em https://webostv.developer.lge.com/ e aceite os termos necessários. Entre com essa conta no Developer Mode da TV.
3. Ative **Dev Mode Status** e aceite reiniciar a TV. Reabra Developer Mode e ative **Key Server**.
4. Deixe computador e TV na mesma rede. Anote o endereço IP e a passphrase mostrados pela TV **apenas para inserir no seu computador**. Não os publique nem envie senhas no chat.
5. No Windows, obtenha o **webOS Dev Manager** em https://github.com/webosbrew/dev-manager-desktop/releases/latest. É uma ferramenta comunitária, não um aplicativo oficial da LG. Escolha o instalador Windows x64 `.msi`.
6. Abra o gerenciador e adicione a TV em **Developer Mode**, usando o IP e a passphrase da tela da TV. O perfil de desenvolvimento normalmente usa SSH porta 9922; o gerenciador orienta os campos.
7. Na área de aplicativos do gerenciador, use **Install** e selecione `com.nex.poc.webos_0.4.8_all.ipk` deste pacote.
8. Abra **NEX** pela TV ou pelo gerenciador. Não abra o `.ipk` como executável Windows e não use pen drive como instalador genérico.

Developer Mode é temporário e exige atenção à sessão/renovação indicada na própria TV. Não fixamos duração em horas: conferir o comportamento atual no aparelho. Não é o fluxo de distribuição comercial definitiva.

## Visual e fluidez

Ícones vetoriais locais consistentes, superfícies de vidro translúcido e foco legível. Desfoque fica restrito a superfícies pequenas e só funciona onde suportado; webOS antigo mantém o acabamento por gradiente/transparência. Sem blur no vídeo nativo. Animações usam a cadência requestAnimationFrame disponível e respeitam movimento reduzido; não há promessa de 120 Hz ou alteração da frequência do painel.

Capas de episódios usam variantes reais de campos, info em objeto/JSON e alternativas HTTP/HTTPS relativas/absolutas; falha tenta outra URL fornecida e termina em placeholder. Não gera frames falsos, não extrai vídeo em segundo plano e não registra URLs sensíveis.

## Validação e build

Na raiz, Node 24 e Chromium/Playwright:

```sh
npm ci
npm --prefix platforms/webos-poc ci --ignore-scripts
npm --prefix platforms/webos-poc test
npx eslint platforms/webos-poc/app platforms/webos-poc/scripts platforms/webos-poc/tests
npm --prefix platforms/webos-poc run build
NOVA_CHROMIUM_PATH=/usr/bin/chromium node platforms/webos-poc/scripts/smoke.cjs
npm --prefix platforms/webos-poc run build:tv
NOVA_CHROMIUM_PATH=/usr/bin/chromium npm --prefix platforms/webos-poc run check:package
```

No CI, Playwright instala seu Chromium e `NOVA_CHROMIUM_PATH` fica vazio. CLI oficial LG 3.2.6 fixada; estado APPDATA isolado no processo filho, sem mudar HOME/perfil. Scripts/CSS locais são embutidos com hashes CSP; dependências npm de QA/empacotamento não vão à TV.

Testes: domínio/ES5, 50 mil registros, URLs/credenciais codificadas, persistência/isolamento/corrupção/quota, cofre real (senha errada e cifra alterada), contrato de áudio/legendas e reconexão limitada/cancelamento. Chromium testa MP4 sintético, controles remotos simulados, filtros/paginação, capas decodificadas, EPG, legendas com TextTrack real, contagem automática, cofre após recarga e retomada real de filme/episódio. O servidor de QA implementa HTTP Range para não confundir ausência de busca com falha de persistência. Capturas usam exclusivamente dados/arte sintéticos.

Isso não certifica codecs, som audível, suporte de faixas no modelo LG, cofre no runtime da TV, CORS/TLS do provedor ou tecla física Voltar. Busca/retomada dependem da fonte; EPG e capas dependem de metadados fornecidos. Sem trailers inventados, detecção automática de abertura, serviços de IA, proxy, DRM ou publicação em loja. Detalhes em `docs/WEBOS_LIBRARY_CHECKPOINT.md`.

## Correções e visual 0.4.1

Cadastro navega por ↑/↓ na ordem dos campos, sem depender da distância visual até Conectar. O catálogo é consultado antes das categorias; falha de categorias não impede acesso aos conteúdos. Respostas em arrays, envelopes conhecidos e mapas de IDs são aceitas; erros/zero registros ficam explícitos com nova tentativa. Isso não confirma a causa específica da tela vazia no provedor real.

Referências do proprietário aplicadas: menu superior, banner integrado à página, fileiras densas de capas, destaque que acompanha o foco e detalhes cinematográficos. Imagens e sinopses continuam vindo somente da fonte; sem dados reais não preencher com obras fictícias. Browser sem construtor URL usa parsing DOM. Após conectar, o campo servidor mostra somente a base normalizada, sem senha/token do link colado.

### Interface e UHD

A resolução lógica 1920×1080 da interface já funcional foi preservada. Ela não é uma configuração de redução do arquivo de vídeo. A reprodução usa o fluxo original e a camada de mídia da TV; reprodução/saída UHD física ainda precisa ser conferida na LG. O portal oficial LG ficou bloqueado (403 do proxy deste ambiente), portanto não presumimos que mudar o manifesto para 3840×2160 seja suportado neste modelo. Não há promessa de HDR, todos os codecs 4K ou transformação de HD em 4K.

### Correção 0.4.1 e TMDB

Layout com top/right/bottom/left e cores rgba para o navegador antigo da TV: sem dependência de inset, clamp ou hexadecimal com alpha. A resolução lógica da interface continua 1920×1080; reprodução original 4K permanece independente.

Em Configurações → Imagens e sinopses · TMDB, informe seu token de leitura e selecione Conectar TMDB. Token somente em memória: não vai no código, IPK, logs ou armazenamento local; precisa ser informado em cada abertura. Desconectar elimina token e cache. Requisições HTTPS independentes com prazo de 10 segundos. O TMDB recebe o título consultado ou ID; não recebe acesso Xtream.

Ao abrir detalhes de filme/série, usa ID TMDB fornecido pela lista; sem ID, aceita somente correspondência única de título exato e ano quando informado. Ambiguidade/falha mantém os dados da fonte. Banner do TMDB quando disponível e sinopse apenas se ausente na fonte. Não oferece vídeos, não altera links de reprodução e não adiciona títulos externos ao catálogo. Cache de até 32 consultas em memória. Sem chamadas reais validadas ao TMDB neste ambiente; testes usam respostas sintéticas. Validar token, CORS e HTTPS na LG física. Uso comercial requer conferir os termos/licença do TMDB antes da distribuição comercial.

### Navegação de TV · 0.4.2

- Menu lateral com ícones e nomes. TV ao vivo, Filmes e Séries abrem subcategorias no mesmo painel; Menu principal retorna às seções, Início permanece acessível. Categorias são as da fonte, sem lista inventada. Todos os conteúdos permanece disponível se a fonte falhar ao fornecer categorias.
- Setas cima/baixo percorrem o menu em ordem; direita entra no catálogo; esquerda na primeira coluna volta à categoria. Voltar com foco nas subcategorias retorna ao menu principal. Demais retornos preservam o histórico de telas.
- TV: primeiro OK abre prévia à direita, segundo OK no mesmo canal amplia sem trocar o src. Em tela cheia ↓ próximo canal e ↑ anterior, dentro da busca/categoria ativa, com volta ao início/fim da lista. Repetição de tecla segurada é ignorada para evitar múltiplas conexões. EPG e confirmação do próximo episódio preservam sua própria navegação. Filmes e séries não usam troca de canais.
- Prévia: tamanho explícito do vídeo sincronizado com a área em pixels ao iniciar/ampliar/voltar/redimensionar. Removidos recorte arredondado e excesso de controles sobre a mídia. HUD compacto deixa uma área central desobstruída. Isso trata possíveis causas de composição/encobrimento; não comprova correção física na LG.
- Busca central no topo da área de conteúdo, campo maior e destaque de foco. Continua buscando a seção atual. Transições de 160–220 ms em foco/menu/textos; sem animar o plano do vídeo ou usar blur pesado. Preferência de movimento reduzido desativa animações/transições e deslocamento das capas.

Testes Chromium cobrem setas reais do menu, retorno principal, busca central, preferência de movimento reduzido, prévia com imagem decodificada e centro não coberto, geometria 1920×1080/1280×720, troca de três canais com ↑/↓, retorno à prévia, EPG, biblioteca e reprodução 4K sintética. TV física, áudio audível e canais do provedor precisam de confirmação manual.

### Ajuste em revisão — navegação contínua e busca lateral

Diretriz posterior do proprietário substitui a busca central: campo arredondado dentro do menu lateral. ↑/↓ nas capas percorrem linhas na mesma coluna, permanecem no catálogo e atravessam páginas automaticamente; nas bordas da coleção mantêm o foco. ← na primeira coluna acessa o menu. Episódios seguem o mesmo percurso. Foco move a capa discretamente para cima, com escala e borda clara; movimento reduzido mantém apenas contraste/borda.

Rolagem manual de 200 ms por requestAnimationFrame, compatível com navegador antigo, cancela animação anterior e respeita movimento reduzido. Foco restaura rolagem após node.focus() para evitar salto nativo antes da animação. Setas laterais no campo continuam editando o texto; cima/baixo movem pelo menu. Alterações visuais aguardam revisão do proprietário antes de envio à TV.

### Revisão do banner e da busca — ainda não enviada à TV

O título e as ações do banner acompanham imediatamente o foco nas capas; imagem troca após 110 ms de permanência para não iniciar downloads em cada passagem rápida. Ações reais: detalhes, adicionar/remover da Minha lista e favorito. Minha lista é separada dos favoritos e persiste apenas IDs no mesmo espaço por conta, compatível com os dados antigos. Para acessar ações pelo controle, ↑ na primeira linha; ↓ retorna à capa atual.

Buscar no menu abre uma tela com campo maior e resultados incrementais na seção atual, com atraso de 180 ms para digitação e processamento de 1.000 registros por lote. Voltar restaura a consulta, categoria e página anteriores sem reconstrução tardia que roube o foco. Bordas de coleção mantêm o foco; não houve mudança no fluxo de TV fullscreen/↑/↓. Capa focada usa elevação/escala/brilho, sem anel ao redor do cartão; movimento reduzido desativa deslocamentos e conserva contraste. Transições de texto de 150 ms; sem IA, trailer, vídeo em segundo plano ou animação sobre o decoder nativo.

### Player — controles mínimos e foco sem bloqueio

Progresso em uma linha própria; pausa/retomar, −10 s, +10 s e Ajustes na linha inferior. Áudio, legendas, velocidade e reinício ficam em painel lateral, com foco por ordem e Concluir/Voltar. Faixas indisponíveis continuam desabilitadas.

No player de filme/episódio: ←/→ percorrem os botões; ↑ entra no progresso; sem modo de edição, ← sai para −10 s e → sai para Ajustes. OK na barra ativa ajuste por ←/→ em dez segundos; OK, ↓ ou Voltar encerram ajuste. ↓ da barra sempre retorna à reprodução. Fora desses modos, HUD segue desaparecendo após cinco segundos. Enquanto painel/ajuste estiver aberto, não oculta controles no meio da interação. Voltar fecha painel antes de sair da reprodução. TV mantém ↑/↓ para troca de canal, exceto dentro do painel de Ajustes. Nenhuma alteração nos links/codecs.

Capturas usam vídeo sintético; testes Chromium verificam pausa, saída do slider, avanço, velocidade real, legendas e fechamento do painel mantendo o vídeo. Não comprovam controle físico LG/áudio audível. Aguardar revisão antes de enviar à TV.

### Logos da lista

TV utiliza a imagem fornecida no registro, com prioridade para stream_icon; aceita também logo/tvg-logo quando presentes. Endereços HTTP(S) absolutos são preservados; caminhos relativos são resolvidos contra o servidor da lista e URLs // herdam seu protocolo, sem anexar usuário/senha ou parâmetros da API. Exibição contain preserva a proporção da logo. Sem imagem ou em caso de erro, placeholder neutro. Nenhuma busca externa ou logo inventada. Capturas antigas tinham canais sintéticos sem stream_icon; os testes agora incluem logos sintéticas fornecidas pela própria fonte simulada e verificam o carregamento das três formas de URL. Validar imagens do provedor na LG física.

### Entrega 0.4.2

Proprietário solicitou o pacote para instalar após a revisão visual. Inclui menu lateral/subcategorias, busca dedicada, banner com ações, Minha lista, logos da fonte e player com Ajustes e saída explícita da barra de progresso. Testes locais: 26 testes, lint, pacote IPK e cenário Chromium com catálogo de 50 mil registros e reprodução sintética HD/4K aprovados. Teste físico da atualização na LG continua pendente.

### Tela de entrada cinematográfica

Banner decorativo original gerado para o NEX, incluído localmente em assets/login-cinema.png; não representa filmes fornecidos pelo app nem consulta catálogo antes do login. Formulário mantém campos e navegação existentes, com fundo escuro para leitura. O fundo é estático (sem vídeo ou animação contínua) e continua disponível offline. Não confundir a resolução da arte de entrada com a resolução original do vídeo reproduzido.

### Correções 0.4.3 — TV ao vivo e temporadas

Com HUD visível, ↑/↓ navegam nos controles, sem trocar canal. Com HUD oculto, ↑/↓ continuam trocando canal. OK mostra controles; teclas nativas ChannelUp/ChannelDown (quando enviadas pela TV) e botões Canal anterior/Próximo canal permitem troca explícita. Dentro de Ajustes/EPG, as setas pertencem ao painel. A barra só habilita busca quando o motor informa uma janela seekable válida, inclusive ao vivo; sua posição corresponde ao intervalo informado. Fontes sem buffer/timeshift não recebem retrocesso fictício.

Temporadas em botões horizontais, com contagem de episódios da fonte. Ao abrir uma série, o foco vai à temporada selecionada após carregar os dados (sem roubar foco se o usuário já tiver navegado). ←/→ mudam o foco, OK confirma, ↓ entra nos episódios, ↑ da primeira linha de episódios retorna à temporada. A escolha não troca só por passar o foco. Rolagem horizontal acompanha o controle, sem scrollbar e com movimento reduzido respeitado. Temporadas vazias mantêm navegação para outras opções, sem episódios inventados.

Testes: 26 unitários/contratos, lint, build e cenário Chromium completo passaram. Novas verificações incluem HUD aberto sem zap acidental, HUD oculto com zap, comandos explícitos de canal, fonte sem seekable, oito temporadas com overflow, confirmação/temporada vazia e ida/volta aos episódios. Controle físico, janela de reprodução da fonte real e visual na LG precisam de confirmação manual.

### 0.4.8 — perfis, Continue e retomada

Depois de conectar/desbloquear a lista, escolha quem vai assistir. Até cinco perfis locais por conta da fonte, com nomes editáveis e favoritos, Minha lista, progresso e preferências separados. O perfil original conserva o armazenamento anterior; atualizar não copia nem apaga seu histórico. A troca interrompe a reprodução e salva o progresso no perfil anterior antes de abrir o seguinte. Catálogo e conexão da fonte são compartilhados, sem repetir downloads por perfil. Não cria contas remotas, assinaturas extras ou sincronização entre TVs. Perfis não são protegidos individualmente por senha.

Continue substitui Continuar assistindo. Filtros Todos/Filmes/Séries não incluem TV ao vivo, inclusive se houver progresso antigo de canais. A lupa agora é um SVG, sem depender de caractere/emoji do sistema.

Página de série identifica o episódio em andamento do perfil, inclusive ao entrar pelo catálogo normal. Banner mostra título, temporada, barra e tempo assistido/restante quando há duração real salva. Continuar abre escolha Do início/Continuar/Cancelar; não altera o progresso ao cancelar. Reiniciar só zera o ponto anterior após a reprodução realmente começar. Voltar do player atualiza o banner e devolve foco aos episódios. Episódio concluído tem posição zero e não entra em Continue.

Desempenho: índice de progresso por série elimina varreduras repetidas. Sem reflow forçado para reanimar o banner e sem filtros/sombras grandes nas capas; transições/rolagem de 140 ms, respeitando movimento reduzido. Imagens remotas da biblioteca usam até três requisições simultâneas, priorizam o destaque e carregam apenas a área visível com pequena margem; itens removidos são cancelados. Relatório e comando reproduzível em docs/WEBOS_PERFORMANCE.md. Medidas Node/Chromium não garantem desempenho na LG.

Testes incluem migração sem alteração do perfil original, limite/renomeação/isolamento de cinco perfis, persistência após reconectar, erro de gravação sem troca de perfil, Continue por tipo e retomada/reinício real de episódio em mídia sintética. Nenhum usuário de teste é distribuído no pacote. A validação física da versão 0.4.8 permanece pendente.
