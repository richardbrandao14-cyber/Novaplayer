# NEX para LG webOS — 0.4.0

Edição de uso com fontes Xtream autorizadas. Alvo do proprietário: LG UM7510PSB, firmware 05.40.97. Canais reais e amostras locais de vídeo/áudio foram confirmados na versão anterior; esta atualização ainda precisa da confirmação física. Não fornece conteúdo, assinatura ou transcodificação.

## Atualizar sem programar

Feche NEX na TV, extraia o ZIP e instale `com.nex.poc.webos_0.4.0_all.ipk` pelo **Install** do Dev Manager. Abra **NEX**. Não desinstale a cada atualização: uma atualização do mesmo ID preserva o armazenamento local; desinstalar pode removê-lo.

## Usar

- Cadastre servidor, usuário e senha. Aceita `http:servidor`, `https:servidor`, HTTP/HTTPS completos, `servidor:porta` e links completos Xtream; sem prefixo assume HTTP. Prefixos com barras ausentes são normalizados e HTTPS explícito não sofre downgrade. Links get.php/player_api.php podem fornecer usuário e senha; parâmetros adicionais são preservados nas consultas e cifrados no cofre. Xtream não usa protocolos arbitrários.
- Para lembrar o acesso, marque **Lembrar meu acesso com proteção** e crie uma senha de desbloqueio com pelo menos oito caracteres. Guarde essa senha: não existe recuperação remota. Ao reabrir, informe somente essa senha. O cofre usa WebCrypto nativo; se o motor do aparelho não o disponibilizar, o recurso fica indisponível e o acesso não é gravado em texto aberto.
- Início, TV ao vivo, Filmes e Séries usam somente o conteúdo da sua fonte. Busca na seção completa, categorias e páginas substituem o antigo corte em 40 registros.
- TV: primeiro clique abre prévia; segundo amplia. Voltar retorna à prévia e depois ao catálogo. **Programação** consulta o EPG oferecido pelo provedor sem parar o vídeo.
- Filme abre detalhes; série abre temporadas e episódios com as imagens fornecidas. **Continuar assistindo** e **Favoritos** sobrevivem ao fechamento, separados por lista.
- O próximo episódio começa após contagem de dez segundos ao terminar. **Cancelar** interrompe a contagem; a preferência fica em **Configurações**.
- Qualidade: URL original da fonte, incluindo 4K compatível, sem transcodificação no aplicativo. O HUD mostra as dimensões reportadas pelo player. O motor nativo de HLS pode adaptar a variante à conexão. Em ferramentas de teste, **Testar vídeo 4K** usa uma amostra local 3840×2160/24 fps, H.264 High 5.1 SDR e AAC.
- Player: pausa, posição quando a fonte permite busca, velocidade, reiniciar, próximo episódio, áudio/legendas quando expostos pela TV. O volume usa o controle da TV. HUD some após cinco segundos e reaparece com interação.
- Falha de rede: até três tentativas automáticas, com espera crescente e botão para tentar novamente. Erro de codec não cria loop automático.
- Configurações permite atualizar catálogo, escolher HLS/MPEG-TS e apagar favoritos/progresso da lista com confirmação. **Minha fonte** troca ou desconecta o acesso; **Esquecer acesso salvo** remove o cofre sem apagar a biblioteca.

Favoritos e progresso armazenam IDs/posições, não URLs, capas, senhas ou dados do servidor. O cofre opcional contém somente cifra autenticada AES-GCM, sal e IV; sua senha de desbloqueio não é armazenada. Criptografia não substitui uma senha forte. Histórico e favoritos não são sincronizados com outros aparelhos.

## Instalação na TV — sem programação

1. Na LG, abra **LG Content Store**, procure **Developer Mode** e instale o app publicado pela **LG Electronics**. A disponibilidade pode variar conforme a região/loja.
2. No computador, crie/ative uma conta de desenvolvedor LG em https://webostv.developer.lge.com/ e aceite os termos necessários. Entre com essa conta no Developer Mode da TV.
3. Ative **Dev Mode Status** e aceite reiniciar a TV. Reabra Developer Mode e ative **Key Server**.
4. Deixe computador e TV na mesma rede. Anote o endereço IP e a passphrase mostrados pela TV **apenas para inserir no seu computador**. Não os publique nem envie senhas no chat.
5. No Windows, obtenha o **webOS Dev Manager** em https://github.com/webosbrew/dev-manager-desktop/releases/latest. É uma ferramenta comunitária, não um aplicativo oficial da LG. Escolha o instalador Windows x64 `.msi`.
6. Abra o gerenciador e adicione a TV em **Developer Mode**, usando o IP e a passphrase da tela da TV. O perfil de desenvolvimento normalmente usa SSH porta 9922; o gerenciador orienta os campos.
7. Na área de aplicativos do gerenciador, use **Install** e selecione `com.nex.poc.webos_0.4.0_all.ipk` deste pacote.
8. Abra **NEX** pela TV ou pelo gerenciador. Não abra o `.ipk` como executável Windows e não use pen drive como instalador genérico.

Developer Mode é temporário e exige atenção à sessão/renovação indicada na própria TV. Não fixamos duração em horas: conferir o comportamento atual no aparelho. Não é o fluxo de distribuição comercial definitiva.

## Validação e build

Na raiz, Node 24 e Chromium/Playwright:

```sh
npm ci
npm --prefix platforms/webos-poc ci --ignore-scripts
npm --prefix platforms/webos-poc test
npx eslint platforms/webos-poc/app platforms/webos-poc/scripts platforms/webos-poc/tests
npm --prefix platforms/webos-poc run build
NOVA_CHROMIUM_PATH=/usr/bin/chromium node platforms/webos-poc/scripts/smoke.cjs
```

No CI, Playwright instala seu Chromium e `NOVA_CHROMIUM_PATH` fica vazio. CLI oficial LG 3.2.6 fixada; estado APPDATA isolado no processo filho, sem mudar HOME/perfil. Scripts/CSS locais são embutidos com hashes CSP; dependências npm de QA/empacotamento não vão à TV.

Testes: domínio/ES5, 50 mil registros, URLs/credenciais codificadas, persistência/isolamento/corrupção/quota, cofre real (senha errada e cifra alterada), contrato de áudio/legendas e reconexão limitada/cancelamento. Chromium testa MP4 sintético, controles remotos simulados, filtros/paginação, capas decodificadas, EPG, legendas com TextTrack real, contagem automática, cofre após recarga e retomada real de filme/episódio. O servidor de QA implementa HTTP Range para não confundir ausência de busca com falha de persistência. Capturas usam exclusivamente dados/arte sintéticos.

Isso não certifica codecs, som audível, suporte de faixas no modelo LG, cofre no runtime da TV, CORS/TLS do provedor ou tecla física Voltar. Busca/retomada dependem da fonte; EPG e capas dependem de metadados fornecidos. Sem trailers inventados, detecção automática de abertura, serviços de IA, proxy, DRM ou publicação em loja. Detalhes em `docs/WEBOS_LIBRARY_CHECKPOINT.md`.

## Correções e visual 0.4.0

Cadastro navega por ↑/↓ na ordem dos campos, sem depender da distância visual até Conectar. O catálogo é consultado antes das categorias; falha de categorias não impede acesso aos conteúdos. Respostas em arrays, envelopes conhecidos e mapas de IDs são aceitas; erros/zero registros ficam explícitos com nova tentativa. Isso não confirma a causa específica da tela vazia no provedor real.

Referências do proprietário aplicadas: menu superior, banner integrado à página, fileiras densas de capas, destaque que acompanha o foco e detalhes cinematográficos. Imagens e sinopses continuam vindo somente da fonte; sem dados reais não preencher com obras fictícias. Browser sem construtor URL usa parsing DOM. Após conectar, o campo servidor mostra somente a base normalizada, sem senha/token do link colado.

### Interface e UHD

A resolução lógica 1920×1080 da interface já funcional foi preservada. Ela não é uma configuração de redução do arquivo de vídeo. A reprodução usa o fluxo original e a camada de mídia da TV; reprodução/saída UHD física ainda precisa ser conferida na LG. O portal oficial LG ficou bloqueado (403 do proxy deste ambiente), portanto não presumimos que mudar o manifesto para 3840×2160 seja suportado neste modelo. Não há promessa de HDR, todos os codecs 4K ou transformação de HD em 4K.
