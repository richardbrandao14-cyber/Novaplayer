# Fase 3 — implementação e teste Windows

Estado em 24/10/2026: **implementação e validação automatizada concluídas; validação manual pendente**. O [build Windows](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40140035463) passou, incluindo Clippy, testes Rust/DPAPI e geração do executável. Ainda não houve abertura manual da interface Windows nem teste com provedor real. Não há reprodução de vídeo nesta versão.

## Implementação

- Backend modular em `src-tauri/src/core/` e `src-tauri/src/services/`: parser M3U, HTTP reqwest/Tokio, cliente Xtream, jobs canceláveis, SQLite e caches.
- URLs e arquivo M3U/M3U8 selecionado por diálogo nativo. M3U8 HLS é rejeitado como catálogo. Limites: 64 MiB por fonte, 100 mil registros e 64 KiB por linha. UTF-8/BOM, UTF-16 e fallback Windows-1252 com aviso.
- Normalização preserva origem e identificadores; dados M3U sem tipo inequívoco permanecem sem classificação e podem ser vistos no Início. Não são automaticamente tratados como TV ou filme.
- SQLite versionado com WAL, transações, índices e paginação até 200 itens. `channels`, `movies` e `series` são views do catálogo normalizado; temporadas/episódios são tabelas, persistidas sob demanda. Falha/cancelamento conserva o catálogo anterior. Jobs interrompidos são recuperados como falha ao reiniciar.
- Xtream: autenticação, categorias, canais, VOD, séries e detalhes de episódios sob demanda, sem importação de todos os episódios no início.
- Proteção de configurações, credenciais e URLs por DPAPI do usuário Windows. Não há fallback em texto puro fora do Windows. Testes Linux usam somente um protetor fictício explícito. O roundtrip DPAPI real foi testado separadamente pela suíte Windows da CI; proteção/recuperação no computador do proprietário ainda integra o teste manual.
- DTOs para React não expõem URLs de reprodução, senhas nem caminhos locais. Comandos Tauri têm permissões explícitas apenas para a janela principal; nenhum plugin genérico de shell, HTTP ou filesystem foi autorizado.
- Cache de imagens sob demanda, 5 MiB de resposta por imagem, quota de 128 MiB e TTL de 7 dias; raster decodificado com limites e normalizado para PNG estático. URLs duplicadas por item são evitadas, mudanças de URL e arquivos órfãos são tratados. Cache de metadados cifrado tem TTL de 1h e limites de tamanho/quantidade.
- Interface existente preservada. Modo real separado de demo; navegador sem Tauri exibe a exigência do aplicativo desktop. Cadastro real, atualização, remoção, progresso sem porcentagens inventadas, cancelamento, catálogos paginados e detalhes estão ligados a adaptadores IPC.

## Verificação executada

| Verificação | Resultado confirmado |
| --- | --- |
| TypeScript strict | Aprovado |
| ESLint | Aprovado |
| Vitest | 27 aprovados em 4 arquivos |
| Playwright/Chromium | 6 cenários aprovados |
| Build Vite | Aprovado |
| Rust sem WebView | 17 testes unitários + 5 testes de integração HTTP aprovados |
| Clippy do núcleo, todos os targets | Aprovado, sem warnings |
| Windows/Tauri/DPAPI | Clippy, testes Rust (incluindo DPAPI) e build aprovados na CI; GUI manual pendente |
| Provedor IPTV real | Não utilizado; somente fixtures e servidores HTTP locais |

Os testes exercitam parsing, caracteres/codificação, entradas inválidas, HLS, limites, migração, paginação, isolamento, atualização atômica, cancelamento, recuperação, arquivo local, autenticação e catálogo Xtream simulado, detalhes de séries, ausência de segredos em DTO/armazenamento de testes, redirects, limites HTTP e erros sanitizados. Testes React usam mocks IPC, não provam execução nativa.

A revisão independente identificou e levou à correção de esperas bloqueantes no executor assíncrono, cancelamento/timeout de DNS, URLs de imagem, recuperação de jobs, tratamento de nomes ausentes e associação de imagem ao ID correto. A revisão não substitui o teste manual Windows com fontes autorizadas.

## Carga sintética medida

Dados brutos: [phase3-load-results.json](phase3-load-results.json). Uma execução por tamanho, build debug Rust em Linux, SQLite **em memória**, URLs fictícias e protetor de fixture XOR **sem valor de segurança**. Não inclui rede, DPAPI, disco do usuário, WebView2 ou GPU. RSS amostrado no processo de teste; compilação excluída.

| Registros | Parsing | Escrita transacional | Consulta (até 100 itens) | Pico RSS aproximado |
| --- | --- | --- | --- | --- |
| 1.000 | 10,2 ms | 30,3 ms | 0,9 ms | 5,7 MiB |
| 10.000 | 105,5 ms | 307,5 ms | 12,0 ms | 18,1 MiB |
| 30.000 | 326,2 ms | 1.138,3 ms | 21,5 ms | 47,0 MiB |
| 50.000 | 691,8 ms | 2.294,6 ms | 56,3 ms | 71,8 MiB |

Cancelamento pré-sinalizado foi medido separadamente; testes adicionais interrompem HTTP pendente e escrita em andamento. Estes resultados demonstram comportamento do núcleo com fixtures, sem garantir desempenho do aplicativo Windows. Responsividade nativa sob DPAPI/disco e memória de catálogo real continuam pendentes.

Reprodução do experimento Linux:

```sh
cargo build --manifest-path src-tauri/Cargo.toml --no-default-features --locked --example catalog_load
python3 scripts/measure_catalog.py
```

## Limitações restantes

- A workflow Windows foi executada e aprovada: https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40140035463. O executável de teste foi guardado como artefato, sem instalador ou Release. A aprovação final ainda requer abrir a interface e importar fontes autorizadas no computador do proprietário.
- Imagens remotas são restritas a HTTPS e IP público, sem SVG/HTML; logos HTTP ou em rede privada usam placeholder. Fontes HTTP/LAN explicitamente cadastradas podem ser importadas, mas redirects entre origens são recusados. Alguns provedores precisarão do endereço direto.
- Diagnósticos de entradas inválidas são agregados; não há relatório detalhado por linha. Avisos de codificação são expostos no relatório final.
- Consulta de categorias ainda não é paginada. Grandes quantidades de categorias e volumes reais de metadados exigem validação adicional.
- O parser é incremental por linha, mas a resposta HTTP/arquivo e o catálogo normalizado são mantidos em buffers limitados durante a importação.
- Nenhuma compatibilidade universal Xtream/codec é prometida. Não há playback, EPG completo, banco remoto, pagamentos, gravação, instalador ou publicação.

## Como fazer o teste Windows

Caminho recomendado para o proprietário: executar a workflow `Validate NOVA PLAYER` no próprio repositório GitHub. Quando o job Windows passar, baixar o artefato `NOVA-PLAYER-Windows-x64-test`, extrair o ZIP e abrir `nova-player.exe`. WebView2 deve estar instalado. Não há instalador nem assinatura de distribuição; não ignorar alertas do Windows sem conferir origem e integridade do arquivo.

A workflow executou o código enviado após autorização explícita do proprietário. O envio foi autorizado pelo proprietário e o commit inicial `b5e96bf` foi enviado para `main`. A primeira execução identificou uma falha Windows; o recurso ICO obrigatório foi corrigido. A execução corrigida foi aprovada em https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40140035463. O código funcional testado corresponde ao commit `debeb31`; commits posteriores apenas atualizam documentação/capturas. O artefato é de teste e não cria GitHub Release nem publicação do aplicativo.

Roteiro de teste:

1. Abrir o aplicativo e navegar pela demonstração.
2. Nas configurações, desativar dados demonstrativos e abrir Minhas Listas.
3. Cadastrar uma URL M3U autorizada ou selecionar um arquivo local; importar e conferir o relatório.
4. Conferir categorias, busca e páginas; registros sem classificação aparecem no Início.
5. Cadastrar um acesso Xtream autorizado e conferir canais, filmes, séries e episódios disponíveis.
6. Atualizar uma fonte e cancelar outra operação. Conferir que erro/cancelamento não apaga o catálogo anterior.
7. Fechar e reabrir: fontes e catálogo reais devem permanecer. Remover uma fonte e conferir isolamento das demais.
8. Não testar reprodução: ela não faz parte desta fase. Não enviar senhas, tokens, URLs completas ou banco de dados pelo chat ao relatar problemas.

Se o Windows não puder gerar/abrir o executável, registrar a falha com sua etapa e mensagem sanitizada. A Fase 4 não foi autorizada nem iniciada.

## Primeiro teste do proprietário

Abra a execução aprovada, entre na sua conta GitHub e, na seção **Artifacts**, baixe **NOVA-PLAYER-Windows-x64-test**. Extraia o ZIP antes de abrir `nova-player.exe`. Não é necessário instalar Node ou Rust para executar esse arquivo. WebView2 deve estar disponível no Windows. O arquivo não foi assinado para distribuição final nem aberto manualmente pelo agente.
