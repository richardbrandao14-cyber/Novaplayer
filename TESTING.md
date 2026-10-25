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
