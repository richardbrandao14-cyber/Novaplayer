> **NOVA Cinema — teste Windows:** [baixe NOVA-PLAYER-Windows-x64-test](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40165447010) (82,4 MB). Feche a versão anterior, extraia **todo o ZIP** e abra `nova-player.exe`. Mantenha `libmpv-2.dll` e `nova-hud.lua` na mesma pasta. Canal/filme iniciam com um clique; séries abrem temporadas, e clicar no episódio reproduz. Vídeo e HUD ficam na mesma janela. [Prévia visual com dados de teste](docs/screenshots/nova-cinema-fixture.png). [Evidências e limites](docs/PLAYBACK_CHECKPOINT.md): testes Windows aprovados; nova composição Tauri/Horizon requer confirmação no PC.

# NOVA PLAYER

Aplicativo desktop de mídia para **Windows 10/11 x64**. O usuário fornece suas próprias fontes autorizadas; o produto não oferece conteúdo ou assinaturas. Linux cloud/CI serve apenas ao desenvolvimento web, sem distribuição desktop Linux/macOS.

## Estado atual

Fase 3 parcialmente concluída: importação/persistência reais implementadas, com build/testes Windows aprovados e validação manual pendente. A interface demonstrativa das Fases 1–2 foi preservada. Oito telas navegáveis, busca global com Ctrl+K, carrosséis, detalhes com temporadas/episódios, favoritos, histórico e cadastro de fontes em memória. Sem streaming, libmpv, EPG real ou serviços externos de metadados. O núcleo Rust agora implementa M3U, Xtream e SQLite. Ver [relatório da Fase 3 e roteiro Windows](docs/PHASE_3.md).

Os dados são fictícios e as imagens são SVGs autorais locais. Fontes demonstrativas retêm somente nome, tipo e origem do servidor, sem usuário/senha, caminho ou query string. Favoritos, histórico e fontes são reiniciados ao recarregar. Somente menu e preferência de demonstração usam localStorage. Não inserir credenciais reais nos formulários.

## Visualizar sem instalador

Requisito: Node **24.19.0**, conforme `.nvmrc`, e npm. Na pasta do projeto:

```sh
npm ci
npm run dev
```

O Vite utiliza a porta 1420, sem depender de Rust/Tauri para abrir a demonstração. Use a ferramenta de acesso ao servidor disponível no seu ambiente; não há publicação ou prévia pública criada. A busca superior abre por clique ou Ctrl+K; Escape fecha modais. As setas navegam pelo menu e pelos resultados de pesquisa. Em janelas estreitas o menu começa compacto e pode ser expandido como painel.

Nesta máquina cloud, use `npm --cache /workspace/.cache/npm ci --no-fund --no-audit` se o diretório padrão do npm não for gravável.

## Verificações

```sh
npm run check       # TypeScript strict, ESLint, Vitest e build Vite
npm run test:e2e    # Playwright / Chromium
```

Para E2E nesta máquina: `NOVA_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`. Em outra máquina, instale antes o navegador com `npx playwright install chromium` e seus pré-requisitos oficiais. Os testes geram capturas reais em `test-results/screens/` (artefatos locais ignorados pelo Git). Resultado local: 19 testes Vitest e 6 cenários Playwright aprovados, além de TypeScript, ESLint e build Vite. Ver [TESTING.md](TESTING.md) para limites de evidência.

## Desenvolvimento desktop Windows

Instalar Rust 1.95.0 MSVC x64 (pin em `rust-toolchain.toml`), Visual Studio Build Tools com C++/Windows SDK e WebView2. No Windows:

```sh
npm ci
npm run desktop:dev
npm run rust:test
npm run desktop:build
```

`desktop:build` utiliza `--no-bundle`: não gera instalador. O [build Windows da CI](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40140035463) passou, incluindo testes e geração do executável. A CI está em `.github/workflows/validate.yml`; nenhum instalador ou Release foi criado. Abertura manual e fontes reais continuam pendentes. Não interpretar testes web, cargo fmt ou leitura de metadados como build/teste nativo aprovado.

## Documentação

- [AGENTS.md](AGENTS.md): regras e fase autorizada.
- [ARCHITECTURE.md](ARCHITECTURE.md): limites e contratos; partes futuras identificadas.
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): NOVA UI.
- [ROADMAP.md](ROADMAP.md): gates e pendências antes de integrações reais.
- [TESTING.md](TESTING.md): execução, evidências e limitações.

O código foi enviado ao GitHub com autorização explícita do proprietário para gerar o executável de teste Windows. Não houve deploy, Release, instalador ou publicação do aplicativo. A Fase 4 não foi autorizada.

## Resultado atual da Fase 3

27 testes Vitest, 6 cenários Playwright e 22 testes Rust headless aprovados; tipos/lint/Clippy/build web aprovados. Os resultados anteriores neste documento descrevem o marco da Fase 2. O modo real exige Tauri Windows; no navegador não simula importação nativa. Para testes Rust sem WebView use `npm run rust:core`. A workflow Windows prepara um executável de teste sem instalador quando enviada/disparada no GitHub. O executável de teste foi compilado no Windows pela [CI aprovada](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40140035463), sem teste manual de GUI.

## Capturas reais da demonstração

- [TV ao Vivo](docs/screenshots/nova-live.png)
- [Detalhes de série](docs/screenshots/nova-series.png)

Estas imagens mostram a interface demonstrativa, sem credenciais ou transmissão real.

## Testar agora no Windows

Na execução aprovada acima, baixe o artefato **NOVA-PLAYER-Windows-x64-test**, extraia o ZIP e abra `nova-player.exe`. Isso dispensa Node/Rust no computador de teste. Siga o [roteiro de importação e persistência](docs/PHASE_3.md). Não há reprodução de vídeo nesta versão.

## Licença

NOVA PLAYER é software livre sob GNU GPL versão 3 ou posterior. Veja [LICENSE](LICENSE).
