# webOS 0.1.1 — inicialização/controle

Relato físico: 0.1.0 exibiu tela preta/botões sem resposta na LG; causa exata ainda não estabelecida. Regressão com CSS/JS externos bloqueados falhou no pacote antigo e passou após bundle inline com CSP SHA-256. O teste usa OK por keydown sem clique automático, verifica “JavaScript OK · Estilo OK”, decodifica referência 720p H.264/AAC e preserva pausa/retorno/foco e fluxos de fonte simulada. Seis testes Node/ES5 e lint aprovados. Referência media/HLS da TV agora é específica deste alvo, sem alterar fixtures Windows. Tentativa file:// no Chromium foi bloqueada pela política deste ambiente; não foi tratada como validação de origem file: ou de aparelho real. [CI](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40717793626) da revisão `0c4571c` aprovou regras, lint, empacotamento e smoke. [ZIP 0.1.1](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40717793626/artifacts/12829516444); confirmação física na LG permanece pendente.

---

# Prova LG webOS — isolada

Alvo informado UM7510PSB/firmware 05.40.97; versão webOS ainda não confirmada. CLI LG 3.2.6 empacotou .ipk. Seis testes Node cobrem URLs, credenciais codificadas/erros sanitizados, limites e episódios, sintaxe ES5, manifesto sem privilégios e ausência de persistência/injeção de HTML. ESLint do alvo passou. Smoke Chromium decodificou MP4 H.264/AAC local, verificou pausa/retorno/foco/setas, três fluxos com fonte simulada, campos limpos, storage vazio e layout 1920/1280. Não confirma HLS, codecs do provedor, áudio audível ou aparelho LG. Detalhes em platforms/webos-poc/README.md.

A cópia de trabalho Windows contém melhorias interrompidas por mudança de foco do proprietário; não fazem parte do commit/pacote webOS. Uma execução incidental da suíte Windows/frontend nesta cópia falhou por componente ContentPreview ainda ausente dessa etapa inacabada. Não foi removido teste nem declarado esse estado aprovado. A PoC tem código/build/testes independentes e os commits selecionam apenas o alvo novo e sua documentação/configuração de lint.

---

# NEX · verificação visual atual

37 testes frontend e 17 cenários de navegação Chromium aprovados; TypeScript, lint e build Vite aprovados. Cenários cobrem busca durante abertura sem bloqueio, foco por teclado, movimento reduzido, banner adaptativo, séries/TV com dados sintéticos e largura de 900/1100/1440 px, além dos fluxos funcionais anteriores. Refinamento CSS final reconferido no cenário visual dedicado. Capturas da abertura pausam apenas a animação da página de inspeção em 350 ms, sem mudar produção. fmt Rust aprovado. [CI web/core/Windows](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40257997772) aprovada para `accff6ca68439ab239778e9ee5f4333b7d05f9bc`: 37 testes frontend, 17 cenários Chromium, núcleo Rust, quatro provas explícitas libmpv, suíte Windows/DPAPI, fmt/Clippy e build Tauri. Evidência do novo executável no checkpoint; teste manual no PC continua pendente.

---

## Marco anterior — histórico

# HUD — regressão de entrada Windows

Revisão `3794f427389c86d9b341a99c0925096fc9fc5dca`: quatro provas libmpv, suíte Rust/DPAPI, fmt, Clippy e build Tauri Windows aprovados na [execução](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40253105812); núcleo e `npm run check` aprovados. PoC primeiro exige janela mpv original desabilitada e depois janela habilitada pela integração; botões usam WM_LBUTTONDOWN/WM_LBUTTONUP sempre. Não usa keydown/keyup da API para substituir cliques. Roda e estado real de pausa/volume continuam obrigatórios. A automação sincroniza posição/hover, portanto ainda não equivale ao teste físico Tauri/WebView2 no PC. A navegação Chromium desta execução aguardava instalação do navegador no registro; ver checkpoint para evidência anterior e pacote corrigido.

---

## Marco anterior — histórico

# Revisão atual — TV/HUD/capas

37 testes frontend, 15 Playwright, 29 Rust headless e tipos/lint/Clippy/build web aprovados. Prova Windows ampliada: entrada por coordenadas e pressionar/soltar para continuar/pausar no OSC, roda para baixar volume, troca de compatibilidade, ocultação em cinco segundos e despertar por tecla. O host é verificado por WM_NCHITTEST/WM_MOUSEMOVE; desktop bloqueado da CI usa a API pública de entrada do mpv para os botões. Não substitui clique manual na composição Tauri/WebView2. [CI Windows/web/core](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40243312208) aprovada para `b6a6140`: quatro provas libmpv, suíte Rust/DPAPI, fmt/Clippy e build Tauri. Pacote em [checkpoint](docs/PLAYBACK_CHECKPOINT.md). Fixtures web não substituem essa prova. Benchmark controlado de imagens documentado, sem promessa de velocidade em provedor real.

---

# Controles em tela cheia — revisão atual

35 testes frontend e build/tipos/lint aprovados. Três testes novos verificam prazo de três segundos, reinício por interação, manutenção de acesso com painel aberto e ausência de ocultação fora da tela cheia. Playwright: 14 cenários, incluindo o fluxo temporizado com mouse/teclado e ajustes. A prova gráfica Windows verifica o HUD nativo visível, ocultação após inatividade mesmo pausado, OSC oculto e reativação por binding. [Gates Windows aprovados](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40198382897): quatro provas libmpv, fmt, Clippy, Rust/DPAPI e build Tauri. Pacote em [checkpoint](docs/PLAYBACK_CHECKPOINT.md). Navegador usa IPC controlado e não comprova desenho do HWND; teste manual com provedor permanece necessário.

---

# Menu contextual e busca — revisão atual

`npm run check`: tipos, lint, 32 testes e build Vite. `NOVA_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: 13 cenários incluindo categoria aplicada à consulta, isolamento Filmes/Séries, filtro do menu, voltar/Início, recolher/expandir, foco, limites de largura 900/1100/1440 e busca durante TV sem novo `play_media`. Captura com fixtures inspecionada. Backend não alterado; a [nova CI Windows](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40195802312) confirmou compilação do frontend incorporado, quatro provas libmpv, Rust/DPAPI e Clippy. Evidências e pacote em [checkpoint](docs/PLAYBACK_CHECKPOINT.md). Teste de composição nativa com o provedor continua manual.

---

# Validação atual — NOVA Library

A revisão atual introduz TV em prévia lateral, páginas de filme/série, episódios com imagens e biblioteca/progresso no SQLite v2. Ver [checkpoint](docs/PLAYBACK_CHECKPOINT.md).

- `npm run check`: tipos, lint, 32 testes e build web aprovados localmente.
- `NOVA_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: cenários com IPC controlado, TV primeiro/segundo clique sem recarregar, retorno, rolagem invisível funcional, menu, ações da biblioteca e temporada preservada. 11 cenários aprovados localmente e no job web da CI.
- `cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --locked`: 26 testes aprovados localmente, incluindo migração do esquema anterior, reabertura em disco, progresso/favoritos após refresh e isolamento de episódios. Clippy do núcleo aprovado.
- Gate Windows: os três testes existentes de libmpv/integração/HWND são preservados; um quarto extrai PNG real limitado e verifica início na posição solicitada. Os quatro passaram no Windows na [execução 40193987175](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40193987175), junto de Clippy, suíte Rust/DPAPI e build Tauri.

Capturas com fixtures locais não validam decodificação. CI nativa não comprova som audível nem a Horizon. Validar manualmente: TV prévia → fullscreen → voltar, trocar canal/categoria; filme favorito/Minha Lista/assistir/retomar após fechar; série temporada/episódio/imagem e retorno; áudio/HUD/DPI.

Os resultados abaixo são históricos e não substituem o checkpoint atual.

---

# Estratégia de validação

## Evidência atual

Em 23/10/2026, no Linux cloud com Node 24.19.0 e Chromium local, a base da Fase 1 foi inspecionada antes de alterações: TypeScript, lint, 10 testes Vitest e build passaram; E2E teve 1 aprovado e 1 falha no rótulo do seletor de temporada. A Fase 2 corrigiu esse rótulo e refinou os componentes sobre a base existente.

Resultado final da Fase 2 é registrado ao final deste documento. Compilação/testes Windows não foram executados. Rust/Cargo 1.95.0 estão disponíveis como tooling em `/workspace/.tools/`; GTK/WebKitGTK não foram instalados, pois Tauri Linux está fora do escopo.

## Validação sem instalações frequentes

O produto tem somente Windows 10/11 x64 como alvo. Linux em cloud/CI é infraestrutura para ferramentas e testes web, sem build desktop Linux; macOS está fora do escopo. Backend nativo, Tauri e libmpv serão validados no Windows.

A implementação atual permite inspecionar React com Vite no navegador com dados demo claramente marcados e adaptadores isolados. Hot reload e testes automatizados substituem reinstalações a cada alteração. Falhas nativas não podem acionar demo automaticamente. Nenhum conteúdo ou credencial real integra fixtures.

| Camada | Ferramenta planejada | Evidência exigida |
| --- | --- | --- |
| Tipos/lint | tsc, ESLint compatível | Comandos completos e status de saída |
| Domínio/interface | Vitest, Testing Library | Casos executados, contagem e resultado |
| Integração | Vitest e Rust | Contratos, erros e persistência real temporária |
| Navegação web | Playwright | Fluxos e asserções, não somente página aberta |
| Backend | cargo test, fmt, clippy | Testes Rust e falhas distinguidas de toolchain |
| Frontend | build Vite | Artefatos de produção gerados |
| Desktop | build Tauri Windows | Compilação MSVC x64, sem equivaler a playback |
| Player | PoC em Windows real | Matriz de mídia, janela, erros e recursos |
| Instalador | Windows limpo/manual | Instalar, abrir, atualizar e desinstalar |

Os comandos atuais estão no README e em package.json. A tabela também descreve verificações de fases futuras. A CI foi configurada, mas não executada remotamente pelo agente. Mocks validam consumidores; não demonstram funcionamento de IPC, credenciais ou libmpv.

## Casos por marco

Fase 1: renderização do shell, navegação mínima, foco, estado demo, ausência de dependência nativa no preview, primeiro teste Rust e contrato simples de IPC no Windows. Fase 2: oito destinos, estados vazio/loading/erro, teclado, movimento reduzido e layouts em escalas distintas. Snapshots visuais complementam asserções de comportamento.

Fases 3–4: M3U com BOM, encoding inválido, atributos faltantes, duplicados ambíguos, linhas excessivas e HLS; Xtream incompleto e erros de autenticação sem vazamentos; redirects, timeout, cancelamento e atualização atômica. SQLite temporário real para migrations, rollback e recuperação após importação interrompida. XMLTV e cache no marco correspondente, incluindo limites, expiração e conteúdo malformado.

Fase 5: critérios nativos em ARCHITECTURE.md. Usar mídia própria/licenciada e servidor local de teste; registrar codec/container e ambiente. Credenciais reais nunca aparecem em traces ou artefatos. Fase 6: favoritos, histórico, retomada e EPG persistidos corretamente entre sessões e atualizações de listas.

## Carga e desempenho

Gerar deterministicamente 1.000, 10.000, 30.000 e 50.000 registros sintéticos, com seed e proporções documentadas de ausências/inválidos. Medir importação total, tempo até primeira página, cancelamento, busca, rolagem, p95 de latência, memória máxima, CPU ociosa e tamanho de banco/cache. Testar refresh com leitores ativos e ciclos repetidos de abertura/fechamento do player.

Registrar commit, build, SO, CPU/GPU/RAM, armazenamento, versão WebView2/libmpv, dataset, repetições, método e resultados brutos. Separar Linux/web de Windows/nativo. Definir orçamento com hardware de referência e baseline medidos; nenhum número é garantia agora. Regressões bloqueiam avanço quando o orçamento aprovado for ultrapassado.

## CI configurada (execução remota não verificada)

Linux: instalação npm congelada, tipos, lint, unitários/componentes, integração web, Playwright e build frontend. Windows: Rust MSVC + pré-requisitos Tauri, cargo fmt/clippy/test e build desktop sem distribuição pública. Fixar toolchains, actions e locks; caches por SO/toolchain/lockfile. Artefatos devem excluir segredos e dados pessoais.

Runners hospedados não comprovam GPU, áudio, DPI e interação humana. PoC e instalador exigem Windows interativo em marcos agrupados, não downloads a cada ajuste. Reportar separadamente testes aprovados, falhos, ignorados e não executados. Preservar código de saída e associar relatórios ao commit testado.

## Execução e escopo dos testes da Fase 2

- `npm --cache /workspace/.cache/npm ci --no-fund --no-audit`: instalação congelada reproduzida.
- `npm run check`: TypeScript strict, ESLint, testes Vitest e build Vite.
- `NOVA_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: suíte em navegador real.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: formatação Rust.
- `cargo metadata --manifest-path src-tauri/Cargo.toml --no-deps --locked --format-version 1`: leitura do manifesto/lockfile; **não compila código Rust**.

Vitest cobre navegação, menu persistido, filtros/favoritos, formulários sem segredos persistidos, busca agrupada por teclado/sem resultados, temporadas e reinicialização da seleção, confirmação de histórico, erro de catálogo, fallback/recuperação de imagem e virtualização. Montagem com 10 mil canais verifica DOM limitado; cálculo de janelas foi exercitado com 1.000/10.000/30.000/50.000 itens, sem afirmar resultados de CPU/memória/carga real.

Playwright cobre todas as telas, restauração de foco, menu/tooltip por teclado, ordenação/categorias, fontes demo com edição/remoção, ausência de tráfego externo nos fluxos de navegação/cadastro e ausência de credenciais no localStorage. Capturas reais em `test-results/screens/` para oito telas, detalhes e busca. Overflow horizontal verificado nas oito telas em 1440, 1100, 900, 650 e 390 px. Isso valida responsividade web; o aplicativo Windows mantém janela mínima configurada de 900 px.

As capturas foram inspecionadas para alinhamentos, contraste visual, sobreposições e enquadramento. Não houve auditoria completa WCAG, teste com leitor de tela, DPI/múltiplos monitores Windows ou benchmark nativo. Busca/filtragem usam dados demo pequenos; milhares de registros reais ainda exigirão backend paginado.

Instalador, libmpv, EPG, IPTV, SQLite e armazenamento Windows de credenciais não foram implementados nem testados nesta fase. Nenhum resultado web pode ser usado para aprovar essas capacidades.

### Resultado confirmado da execução final

- Instalação congelada: aprovada (340 pacotes instalados).
- TypeScript e ESLint: aprovados, sem erros/avisos de lint.
- Vitest: **19 aprovados**, 3 arquivos; nenhum falho ou ignorado.
- Playwright/Chromium: **6 aprovados**, nenhum falho; 10 capturas geradas.
- Build Vite: aprovado, com chunks de páginas separados.
- Rust formatting e metadados/lockfile: aprovados; nenhum teste Rust ou build Tauri executado.
- CI remota, WebView2/Windows, playback nativo e instalador: **não executados**.

O estado final do frontend está disponível para aprovação visual. A Fase 3 não foi iniciada; o gate Windows permanece pendente antes das integrações reais.

## Fase 3 — resultado mais recente

Ver [docs/PHASE_3.md](docs/PHASE_3.md): 27 Vitest, 6 Playwright, 17 unitários Rust e 5 integrações HTTP aprovados; TypeScript, ESLint, Clippy e build Vite aprovados. Benchmarks sintéticos registrados em JSON. Estes resultados substituem os números do marco anterior da Fase 2. Tauri/DPAPI/WebView2 Windows e provedores reais não foram executados; fase parcialmente concluída.

## Validação Windows confirmada

Execução [40140035463](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40140035463) aprovada: jobs web, core e Windows concluíram com sucesso. No Windows, `cargo fmt`, Clippy, `npm run rust:test` (inclui teste DPAPI real) e `desktop:build --target x86_64-pc-windows-msvc` passaram, e o artefato de teste foi enviado. Código funcional `debeb31`. Estes resultados substituem as pendências de compilação Windows dos marcos anteriores; teste GUI manual e provedor real continuam não executados.

## Correção do acesso à importação real e NOVA Crimson

O proprietário confirmou que a lista havia sido cadastrada no formulário demonstrativo; isso não demonstra falha de rede ou do parser. A ação principal de Minhas Listas no Windows agora permite entrar diretamente no cadastro real com a demonstração ativa, com aviso explícito. O formulário Xtream mantém tipo/URL em falha, limpa a senha e mantém mensagens sanitizadas. Dois testes de regressão acrescentados; 29 Vitest aprovados. O uso com a fonte real do proprietário ainda precisa ser realizado no modo nativo.

### Relato manual do proprietário

O proprietário confirmou abertura da interface Windows e avaliou o design. A primeira lista foi adicionada na demonstração, sem conexão real. Após orientação para o modo real, relatou estado “Falhou”; a mensagem detalhada e o tipo da fonte ainda são necessários. Não classificar esse acesso como validado nem atribuir a causa a rede/autenticação/parser sem a informação. O refinamento Crimson e o acesso direto ao modo real são melhorias independentes; não são prova de correção da falha dessa fonte.

## Reprodução nativa — marco autorizado pelo proprietário

O proprietário autorizou libmpv, áudio e GPL em 25/10/2026. Implementação em validação: motor carregado de caminho absoluto, trabalhador dedicado, URLs descriptografadas somente no Rust, controles tipados e episódios escopados à série. A janela de vídeo é própria, sem sobreposição com WebView. Nenhuma promessa de reprodução no provedor real antes do reteste.

A PoC Windows deve executar explicitamente o teste ignorado `windows_mpv_decodes_local_video_and_pcm_audio` com `NOVA_MPV_DLL` apontando para a DLL verificada. Usa AVI sintético local (padrão de teste + tom de 440 Hz, criado via FFmpeg), saída de vídeo e áudio nulas: verifica decodificação, avanço do relógio, pausa, volume, mudo e seek. Depois abre HLS sintético (MPEG-2/AAC) via HTTP local e verifica áudio/vídeo e avanço do relógio. **Não comprova áudio audível, renderização GPU, codecs de provedores, HLS de provedores, DPI, monitor, fullscreen ou drivers de áudio.** Esses itens precisam de teste Windows manual; não equivalem a build aprovado.

Teste manual agrupado: extrair o ZIP inteiro, abrir aplicativo, cadastrar fonte real, importar e abrir canal/filme/episódio; confirmar imagem, ouvir áudio, testar volume/mudo, faixas disponíveis, pausa/seek apenas quando suportados, tela cheia, fechar/reabrir vídeo e encerrar aplicativo. Não enviar senhas nem URLs completas ao suporte.

### Evidência do fluxo integrado

Na revisão `7892e23`, o gate Windows executa explicitamente dois testes ignorados nas suítes comuns (`cargo test ... windows_mpv_ -- --ignored --nocapture`). Um cobre AVI local, controles de pausa/volume/mudo/seek, HLS por HTTP e bloqueio de referência a arquivo local em HLS remoto. O segundo autentica em um servidor Xtream sintético, importa TV/filme/série com SQLite e DPAPI reais, consulta episódio por ID interno e decodifica vídeo **e áudio** das três URLs recuperadas pelo backend. O filme/episódio usa MP4 H.264/AAC; a TV usa MPEG-TS MPEG-2/AAC. Todos são fixtures locais, sem credenciais reais.

Amostra HLS inicialmente usou extensão incompatível com a lista de segmentos permitidos do FFmpeg. Após corrigir a amostra, o log Windows mostrou que `access-references=no` bloqueava os segmentos HTTP. A correção permite referências de rede com protocolos aninhados limitados e `load-unsafe-playlists=no`; o teste negativo serve uma playlist real que aponta a um segmento local válido e exige falha. Logs do decodificador são habilitados **somente** em testes com essas fixtures; a aplicação mantém logs do motor desligados.

O proprietário confirmou que Horizon reproduz TV, filmes e séries no Smarters no mesmo PC. No NOVA antigo: 0 registros, 0 processados, erro genérico. Não há código de erro original nem acesso à fonte real no ambiente. As correções de endpoint Xtream e mensagens são comprovadas nos testes; o funcionamento da Horizon no NOVA continua pendente de reteste no computador do proprietário.

### Resultado final do build de teste

[CI Windows/web/core](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40161854232) aprovada em 25/10/2026 para `7892e23`. Dois testes de reprodução executados explicitamente e aprovados; demais gates e build passaram. Pacote portátil com executável, DLL verificada e avisos, 82 MB, artefato `12586348139`. Detalhes e digest em [checkpoint](docs/PLAYBACK_CHECKPOINT.md). Imagem visível, som audível e Horizon real ainda não validados manualmente.

## NOVA Cinema — validação de usabilidade e composição nativa

O proprietário confirmou que a versão anterior funcionou com a Horizon, relatando canal/filme/série abrindo e reproduzindo em janela separada. A revisão atual muda a superfície e o fluxo; a confirmação anterior não substitui o reteste desta composição.

32 testes frontend e 8 Playwright aprovados localmente: um clique para filme/episódio, criação da superfície antes do load, montagem StrictMode sem dupla abertura, pausa por espaço, volume/mudo/velocidade, fechamento da superfície, retorno à temporada, navegação existente e prévia sem rede externa. A prévia usa dados e artes sintéticos, convertidos localmente para PNG somente pelo adaptador de teste. Não há mock de importação ou playback na aplicação distribuída.

Novo gate Windows explícito: janela de teste + HWND filho + renderer gráfico real + script NOVA/OSC + resize para 800 pixels + ação Lua encaminhada + screenshot com pixels de vídeo. A prova não usa WebView e mantém áudio desativado nessa janela; os outros dois gates preservam testes de áudio e integração Xtream/DPAPI. Ver resultado final e limites em docs/PLAYBACK_CHECKPOINT.md.

Teste manual agrupado: extrair ZIP completo; conferir `nova-player.exe`, `libmpv-2.dll` e `nova-hud.lua` juntos; abrir Horizon existente; testar um clique em canal/filme/episódio, HUD, áudio/legendas/velocidade, espaço/setas/M/F/Esc, voltar à mesma temporada, trocar conteúdo, redimensionar, tela cheia e fechar. Não gerar instalador nem Release.

Resultado final NOVA Cinema: [CI](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40165447010) aprovada para `94bd633003c50b4e98b556bff0ce2e259da13840`; três provas de reprodução Windows, suites e build passaram. Artefato `12588251735` (82,4 MB). A correção do servidor de fixtures trata headers TCP completos e herança do modo não bloqueante no Windows. Nenhum teste removido/ignorado para liberar build; os testes marcados como ignorados nas suites comuns são executados explicitamente no gate.

## Biblioteca webOS 0.2.0

Marco e limitações em [WEBOS_LIBRARY_CHECKPOINT.md](docs/WEBOS_LIBRARY_CHECKPOINT.md). Canais reais foram confirmados pelo proprietário na versão anterior. Nesta entrega: domínio ES5, lint, IPK e Chromium com 50 mil registros, busca/paginação/categorias, filmes/séries, próximo episódio, favoritos de canais, imagens remotas decodificadas, HUD e evento cancelável Voltar passaram. Isso não certifica nova UI, tecla física, filmes/séries ou desempenho na LG. Credenciais/favoritos/progresso permanecem somente na sessão. Não executar/afirmar testes Windows a partir deste marco isolado.
