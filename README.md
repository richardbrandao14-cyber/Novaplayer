# NOVA PLAYER

Player desktop para **Windows 10/11 x64**. O usuário fornece suas fontes autorizadas; o app não oferece conteúdo ou assinatura.

## Estado atual

Importação real M3U/Xtream, SQLite e reprodução com áudio via libmpv implementados. O proprietário confirmou reprodução da Horizon e aprovou o visual integrado anterior. Esta revisão acrescenta:

- TV com categorias/canais visíveis: primeiro clique abre prévia lateral; segundo clique no mesmo canal amplia sem recarregar.
- Filmes com página própria, favoritos, Minha Lista, assistir e continuar.
- Séries com página cinematográfica, temporadas e cartões de episódios com imagens da fonte ou frame real quando possível.
- Menu recolhível com ícones/texto, rolagem sem barras e persistência de favoritos/progresso.

**Revisão em validação Windows.** O último pacote aprovado está no [checkpoint de reprodução](docs/PLAYBACK_CHECKPOINT.md), junto às evidências e limites. Não foi criado instalador, Release ou publicação.

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
