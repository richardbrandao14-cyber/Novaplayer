# NEX

## Teste LG webOS

Prova isolada para a LG UM7510PSB, firmware informado 05.40.97: [instalação passo a passo](platforms/webos-poc/README.md). Gera `.ipk` com ferramenta oficial LG, teste local H.264/AAC, HLS local e fonte Xtream/URL direta. Seis testes de regras/compatibilidade, lint e smoke Chromium aprovados localmente. Execução física, áudio audível e fonte real na TV ainda não confirmados. Não é a edição completa NEX para webOS.

Player desktop para **Windows 10/11 x64**. O usuário fornece suas fontes autorizadas; o app não oferece conteúdo ou assinatura.

## NEX · nova identidade visual

Assinatura laranja, marca/ícone vetoriais locais, abertura breve não bloqueante, catálogo com cantos arredondados, busca presente e banners que se adaptam à proporção das imagens fornecidas. A identidade não altera identifier, diretórios, credenciais, fontes ou contratos do player. Nenhuma API de IA ou serviço pago foi integrado.

[Início com dados sintéticos](docs/screenshots/nex-home-fixture.png) · [Séries](docs/screenshots/nex-series-fixture.png) · [TV](docs/screenshots/nex-live-fixture.png) · [Abertura](docs/screenshots/nex-opening.png).

37 testes frontend, 17 cenários Chromium, tipos/lint/build web aprovados localmente. Ajustes visuais finais reconferidos no cenário dedicado. **[Baixar ZIP NEX Windows](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40257997772/artifacts/12622604738) — 82,6 MB.** [CI web/core/Windows aprovada](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40257997772), incluindo quatro provas libmpv e build Tauri. Feche o app, extraia todo o ZIP e abra `nova-player.exe`; nome técnico do executável permanece para compatibilidade. Ver [checkpoint](docs/PLAYBACK_CHECKPOINT.md). Capturas não comprovam reprodução nativa.


## HUD — correção de entrada Windows

A DLL mpv desabilitava sua janela embutida, bloqueando entrada normal do Windows. O app agora habilita a entrada após criação/recriação do vídeo. A nova regressão confirma o estado original desabilitado e exige cliques WM_LBUTTONDOWN/UP alterando pausa e roda alterando volume, sem injetar os botões pela API do motor. Testes nativos e build Windows aprovados.

**[Baixar ZIP Windows corrigido](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40253105812/artifacts/12621333049) — 82,6 MB.** Feche o app, extraia **todo o ZIP** e abra `nova-player.exe`; mantenha DLL e HUD juntos. Ainda requer confirmação manual no PC. [Evidências e estado das verificações](docs/PLAYBACK_CHECKPOINT.md).

## TV, controles e capas — marco anterior

Favoritos por canal com filtro próprio na TV, correção do mouse do HUD, controles com prazo de cinco segundos e modo de compatibilidade para experimentar em canais com áudio sem imagem. Capas agora usam carregamento paralelo limitado, cache compartilhado, derivados menores e prioridade para destaques. **[ZIP anterior — HUD reportado como não interativo](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40243312208/artifacts/12618225781) — 82,6 MB.** [Validação web/core/Windows](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40243312208): testes, quatro provas libmpv e build Tauri aprovados. Feche o app e extraia **todo o ZIP**, incluindo DLL e `nova-hud.lua`, antes de abrir `nova-player.exe`. [Evidências e limites](docs/PLAYBACK_CHECKPOINT.md).

## Tela cheia — marco anterior aprovado

Voltar e controles agora desaparecem após cerca de três segundos sem interação e reaparecem com mouse/teclado. O vídeo ocupa toda a janela, com cabeçalho nativo sobre a imagem. **[ZIP Windows deste marco](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40198382897/artifacts/12601015641) — 82,5 MB.** [Gates web/core/Windows aprovados](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40198382897). Feche o app e extraia todo o ZIP, incluindo `nova-hud.lua`; copiar só o exe não atualiza o HUD. [Evidências e limites](docs/PLAYBACK_CHECKPOINT.md).

## Menu e busca — marco anterior aprovado

Filmes/Séries agora abrem suas categorias no mesmo menu lateral, com retorno ao menu principal, Início direto e filtro de categorias. Busca global maior no topo; abrir/fechar durante prévia preserva o stream. [Captura identificada com dados de teste](docs/screenshots/nova-category-menu-fixture.png). **[ZIP Windows deste marco](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40195802312/artifacts/12599836666) — 82,5 MB.** [CI aprovada](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40195802312), com 32 testes frontend, 13 cenários de navegação, quatro provas libmpv e build Tauri. Feche a versão anterior e extraia todo o ZIP. Novos fluxos ainda precisam de confirmação manual com Horizon. [Evidências](docs/PLAYBACK_CHECKPOINT.md).

## Estado anterior aprovado

Importação real M3U/Xtream, SQLite e reprodução com áudio via libmpv implementados. O proprietário confirmou reprodução da Horizon e aprovou o visual integrado anterior. Esta revisão acrescenta:

- TV com categorias/canais visíveis: primeiro clique abre prévia lateral; segundo clique no mesmo canal amplia sem recarregar.
- Filmes com página própria, favoritos, Minha Lista, assistir e continuar.
- Séries com página cinematográfica, temporadas e cartões de episódios com imagens da fonte ou frame real quando possível.
- Menu recolhível com ícones/texto, rolagem sem barras e persistência de favoritos/progresso.

**[Baixar pacote Windows de teste](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40193987175/artifacts/12599217378) — 82,5 MB.** [CI aprovada](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40193987175): web, núcleo e Windows, incluindo quatro provas explícitas de libmpv. Feche a versão anterior, extraia **todo o ZIP** e abra `nova-player.exe`; mantenha DLL e HUD na mesma pasta. Não foi criado instalador, Release ou publicação.

[Evidências e limites](docs/PLAYBACK_CHECKPOINT.md). Os novos fluxos e imagens ainda precisam de teste manual com a Horizon no PC.

[Captura da página de série](docs/screenshots/nova-series-page-fixture.png), com imagens e dados sintéticos identificados. A prévia web não comprova reprodução nativa.

## Desenvolvimento e prévia web

Node 24.19.0 e npm, conforme `.nvmrc`:

```sh
npm ci
npm run dev
npm run check
npm run test:e2e
```

Vite na porta 1420. O navegador oferece demonstração isolada; conexão e reprodução reais exigem Tauri Windows. Nunca inserir credenciais em fixtures ou documentação. Na cloud, usar `NOVA_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`.

## Desenvolvimento Windows

Rust 1.95.0 MSVC x64, Visual Studio Build Tools com C++/Windows SDK e WebView2:

```sh
npm ci
powershell -File scripts/prepare-player.ps1
npm run desktop:dev
npm run rust:test
npm run desktop:build
```

O motor deve ficar ao lado do executável, com `libmpv-2.dll` e `nova-hud.lua`. A CI prepara o pacote portátil de teste após os gates; `desktop:build` não gera instalador. A migração SQLite v2 conserva o catálogo e exige esta versão ou posterior.

Linux cloud testa frontend e núcleo com `npm run rust:core`, sem criar distribuição desktop Linux. Credenciais reais são protegidas pelo Windows/DPAPI.

## Documentação

[AGENTS.md](AGENTS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) · [TESTING.md](TESTING.md) · [ROADMAP.md](ROADMAP.md) · [Checkpoint atual](docs/PLAYBACK_CHECKPOINT.md). Marcos anteriores ficam nos relatórios em `docs/`.
