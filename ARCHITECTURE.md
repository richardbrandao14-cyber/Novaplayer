> Estado atual de reprodução e composição: [NOVA Cinema](docs/PLAYBACK_CHECKPOINT.md). O primeiro player em janela própria foi confirmado pelo proprietário com Horizon. A nova superfície é HWND filho da janela principal com HUD nativo OSC e script NOVA controlado; cabeçalho/painéis React não se sobrepõem à superfície. Gate gráfico Windows específico e reteste Tauri manual são distintos.

# Arquitetura técnica

Estado atual: interface demonstrativa, catálogo real M3U/Xtream e SQLite implementados. Player libmpv autorizado pelo proprietário e em validação Windows; decisão e evidências atuais em docs/PLAYBACK_CHECKPOINT.md e TESTING.md. As seções originais abaixo registram o planejamento e os critérios de validação. Único alvo do produto no escopo atual: Windows 10/11 x64. Linux e macOS não terão builds desktop ou compromissos de compatibilidade. Arquitetura selecionada: Tauri 2 + React/TypeScript/Vite, serviços Rust/Tokio, SQLite e libmpv condicionado à PoC.

## Viabilidade e versões

Consulta HTTPS ao registro oficial npm em 23/10/2026, tag `latest`:

| Dependência | Versão consultada | Observação |
| --- | --- | --- |
| React / React DOM | 19.3.1 | Manter versões iguais |
| TypeScript | 7.0.2 | Validar ferramentas de lint/tipos na Fase 1 |
| Vite / plugin React | 8.3.5 / 6.1.2 | Plugin declara Vite 8; Node local satisfaz engines |
| Tauri API / CLI | 2.12.4 / 2.12.4 | Confirmar compatibilidade com crate Rust 2.x |
| Tailwind / plugin Vite | 4.3.3 / 4.3.3 | Plugin aceita Vite 8 |
| Radix UI | 1.8.1 | Peer aceita React 19 |
| shadcn CLI | 4.22.1 | Gera componentes locais; não é runtime obrigatório |
| Motion | 14.6.0 | Peer aceita React 19 |
| Zustand | 5.0.16 | Peer aceita React >=18 |
| Lucide React | 1.61.0 | Peer aceita React 19 |
| Vitest | 5.0.5 | Engines aceitam Node 24, peer aceita Vite 8 |
| Playwright | 1.64.1 | Node >=20 |
| TanStack React Virtual | 3.14.22 | Considerar somente no marco de catálogos |

Esses dados comprovam disponibilidade e compatibilidade declarada parcial, não instalação conjunta ou estabilidade do aplicativo. Reconsultar antes da instalação; não usar `latest` em scripts reproduzíveis. Fixar versões exatas no manifesto e lockfiles após prova de build. A API oficial crates.io informou versões estáveis Tauri 2.12.5, Tokio 1.54.1 e rusqlite 0.40.2 nesta consulta. Rust stable MSVC x64, MSRV e compatibilidade entre crates/plugins serão confirmados e fixados na Fase 1; versões menores de API/CLI/crate Tauri não precisam coincidir numericamente, mas precisam ser compatíveis. Não instalar toda a tabela imediatamente.

Windows exige Visual Studio Build Tools (C++/SDK), Rust `x86_64-pc-windows-msvc` e WebView2. Confirmar requisitos oficiais e versão mínima do Windows suportada por cada dependência antes do primeiro build. O host Linux será usado somente como ambiente de ferramentas e validação web; não instalar GTK/WebKitGTK para compilar Tauri Linux. Preview React será independente dessas dependências. Builds e testes do backend nativo e do desktop ocorrerão no Windows.

## Limites e fluxo

React → portas TypeScript → adaptador Tauri IPC → comandos Rust → serviços de aplicação → domínio/adaptadores SQLite, rede e player. Um adaptador web demonstrativo implementa as mesmas portas, sem importar runtime nativo. Somente o ponto de composição escolhe o adaptador; não espalhar verificações de plataforma nas páginas.

A interface renderiza e recebe intenções. Não processa grandes listas, não abre bancos nem conhece credenciais. Zustand mantém navegação, filtros, seleção e preferências efêmeras; o catálogo completo permanece no banco. Estado durável tem SQLite como fonte de verdade.

### Contratos planejados

| Porta | Entrada/saída e garantia |
| --- | --- |
| SourceRepository | Listar descritores sem segredos; criar/atualizar/remover por sourceId; referências de credencial opacas |
| ImportService | Iniciar por sourceId → jobId; progresso, cancelamento e resumo com contagens e avisos |
| CatalogQuery | Tipo, categoria, busca, cursor e limite → página de itens e próximo cursor |
| PlayerPort | Abrir mediaId/sessionId; comandos tipados; eventos de estado/posição/erro |
| PreferencesRepository | Ler/alterar preferências validadas e versionadas |

DTOs serde com esquema documentado; alinhar tipos TypeScript por geração ou teste de contrato no marco de IPC. IDs opacos em string, datas UTC ISO 8601 e durações em milissegundos; limitar inteiros a faixa segura do JavaScript. Não aceitar comandos mpv arbitrários pela interface.

Erros públicos: código estável, mensagem segura em português, operação e identificador de correlação. Eventos de importação contêm jobId, geração, processados, inválidos, total opcional e estado. Eventos do player contêm sessionId e sequência; descartar eventos de sessões antigas. Logs internos estruturados e higienizados, nunca erros brutos de URL/provedor. Limitar frequência de eventos de progresso/posição para evitar saturação IPC.

## Serviços e persistência futuros (Fase 3 em diante)

Tokio coordena I/O, cancelamento e prazos. Parsing e SQLite bloqueantes ficam fora do executor/UI, em trabalhadores dedicados ou spawn_blocking com concorrência limitada. Cancelamento deve ser cooperativo, inclusive entre lotes; abandonar uma task bloqueante não a interrompe.

SQLite em diretório de dados do aplicativo, com migrations transacionais, foreign keys, WAL e busy timeout. Usar rusqlite com SQLite bundled como escolha inicial para reduzir diferenças de instalação, confirmando licença/toolchain. Uma fila de escrita; leituras paginadas e transações curtas. Backup antes de migrations destrutivas; impedir abertura por versão incompatível.

Entidades previstas: sources, imports, categories, media_items, series, seasons, episodes, epg_channels, epg_programmes, favorites, playback_progress, history e preferences. Segredos não entram nessas tabelas. Cada item tem ID interno e sourceId, preservando providerId/tvg-id originais quando presentes. Atualizações não podem depender apenas do título; identidade ausente/ambígua exige política conservadora e registro do conflito. Não fundir fontes automaticamente.

Importar em staging por geração: streaming com limites de bytes, registros, campo e duração, batches pequenos, detecção de inválidos e transação final que ativa a geração. Cancelamento/falha preserva catálogo anterior; limpar staging abandonado no próximo início. Exclusões de fonte limpam dados relacionados sem remover acidentalmente dados de outras fontes.

Busca e índices por sourceId/tipo/categoria e identificador externo; considerar FTS5 depois de medir. Paginação por cursor estável com desempate por ID; virtualização de linhas/grades, debounce/cancelamento de buscas, imagens lazy e eventos limitados. Nunca enviar 50 mil objetos em um único IPC.

M3U/M3U8: preservar metadados e codificação diagnosticável; separar playlist de catálogo e manifesto HLS de mídia. Xtream: adaptador por capacidades observadas, timeouts e erros específicos; não presumir campos ou endpoints uniformes. XMLTV: parsing incremental fora da UI, fuso horário explícito, associação conservadora e desativação de entidades externas/DTD. Nomes ausentes aparecem como informação indisponível, sem inventar metadados.

Cache de imagens controlado no Rust: chave derivada, limite de tamanho/tipo e descompressão, TTL, LRU e quota configurável; arquivos temporários com renomeação atômica. Não usar URL com token como nome de arquivo ou chave exposta. Placeholder NOVA UI para falhas. Serviços externos de metadados ficam fora do escopo.

## Segurança

Windows Credential Manager, por adaptador nativo, será a primeira opção para segredos. Persistir apenas referência opaca no banco; se indisponível, falhar com mensagem clara, sem fallback em texto puro. URLs de origem com tokens e URLs de reprodução sensíveis pertencem ao mesmo limite de proteção. Verificar como proteger catálogos que inevitavelmente contenham URLs assinadas: preferir IDs/paths não sensíveis e resolução nativa, com proteção por usuário no disco quando inevitável. Definir e testar esse formato antes da persistência real na Fase 3.

Aceitar inicialmente HTTPS/HTTP para fontes com aviso explícito para HTTP; negar esquemas executáveis e caminhos arbitrários. Limitar redirects e revalidar destinos a cada salto. Redes privadas podem ser necessárias para IPTV doméstico: só acessar destinos explicitamente configurados, nunca descobrir redes automaticamente. Não encaminhar credenciais entre hosts após redirect. Importação local somente por seletor autorizado, com limites e leitura sem execução.

CSP restrita, nenhum conteúdo remoto executável no WebView, descrições como texto, nenhuma HTML remota. Imagens passam pelo cache validado. Capabilities Tauri por janela e comando; sem permissões genéricas de shell, rede ou filesystem para React. Validar novamente entradas no Rust. Serviços de mídia ficam fora da UI, mas no mesmo processo inicialmente; isso não isola crashes da libmpv. Se a PoC indicar instabilidade, avaliar processo auxiliar mediante decisão arquitetural explícita.

## libmpv no Windows: decisão condicionada

Não há integração aprovada nem codec validado. Estratégia candidata: carregar libmpv x64 de caminho controlado no diretório do aplicativo, com DLLs/ABI/proveniência fixadas. Não procurar DLL em diretório de trabalho ou PATH arbitrário. Wrapper Rust mínimo encapsula FFI e lifecycle; um trabalhador controla handle, fila limitada de comandos e espera por eventos. Não bloquear thread principal; destruir handle e recursos em ordem no encerramento.

Primeira alternativa da PoC: janela nativa dedicada ao vídeo com HWND filho dedicado para `wid`, controles fora da superfície de vídeo. Não passar o HWND do WebView como solução presumida. A composição de HWND e WebView2 possui risco de sobreposição (airspace), foco e z-order. Controles React sobre vídeo não estão garantidos. A PoC deve comparar disposição sem sobreposição e opções de controles nativos antes de prometer controles sobrepostos.

Alternativa, se reprovada: render API em superfície/contexto nativo com thread de renderização própria; não transferir frames por IPC/JavaScript. Essa via tem maior complexidade de GPU/contexto e exige nova estimativa antes da adoção. Os headers oficiais documentam embedding por `wid`, restrições de threads/contexto e risco de deadlock na render API.

Critérios de aprovação da PoC, em Windows real: reprodução de arquivo de teste autorizado e HLS local; áudio, pause, seek de VOD, volume, faixas e legendas; resize, minimizar/restaurar, DPI 100/150/200%, múltiplos monitores, foco/atalhos, fullscreen, fechar/reabrir e encerramento sem processo pendurado. Testar perda de rede, reconexão limitada e cancelamento de abertura. Registrar aceleração por hardware efetivamente usada e fallback; medir uso de recursos em ciclos repetidos. TV ao vivo sem timeshift não deve expor seek/pausa como garantidos.

A PoC deve acontecer como gate inicial da Fase 5, isolada da interface principal; registrar limitações antes de integrar. O contrato PlayerPort permite adiar a decisão de superfície sem reescrever catálogos. Não distribuir libmpv antes de revisar licenças do build real, FFmpeg/codecs, origem, hashes e exigências de redistribuição. Licença permissiva do header não determina licença do binário.

## Estrutura modular de referência

```text
src/
  app/                 # composição, navegação e providers
  ui/                  # NOVA UI: tokens e primitivas
  components/          # componentes compartilhados
  pages/               # início, ao vivo, filmes, séries, favoritos,
                       # continuar assistindo, listas e configurações
  domain/iptv/         # contratos e tipos sem React
  services/            # casos de uso frontend
  integrations/        # adaptadores web-demo e Tauri
  state/               # Zustand
  persistence/         # portas de persistência da interface
  player/              # contratos e apresentação
  demo/                # fixtures explícitas e determinísticas
src-tauri/
  src/{commands,domain,services,integrations,persistence,player}/
  capabilities/
  migrations/
tests/{unit,components,integration,e2e,fixtures,load}/
docs/decisions/        # decisões adicionais quando necessárias
.github/workflows/
```

Não criar módulos vazios para simular progresso. Os seis documentos da raiz são a referência inicial; registrar decisões adicionais somente quando necessário.

## Fontes e limites da pesquisa

Metadados de https://registry.npmjs.org (pacotes listados) e https://crates.io/api/v1/crates/ (tauri, tokio e rusqlite) consultados diretamente. Headers oficiais consultados em https://raw.githubusercontent.com/mpv-player/mpv/master/include/mpv/client.h e https://raw.githubusercontent.com/mpv-player/mpv/master/include/mpv/render.h; branch master é referência de arquitetura, não versão binária aprovada.

https://v2.tauri.app/start/prerequisites/, https://v2.tauri.app/security/capabilities/ e https://mpv.io/manual/stable/ retornaram bloqueio 403 do proxy. Reconsultar documentação oficial na Fase 1 e na PoC; essa limitação não autoriza desligar verificações TLS nem prova incompatibilidade da stack.

## Implementação demonstrativa da Fase 2

A base Tauri/React foi preservada; IPC/permissions não foram ampliados. As oito páginas continuam lazy-loaded. `GlobalSearch` pesquisa dados locais com normalização de acentos, processamento adiado e limite de resultados. Filtros e ordenação são exclusivamente frontend demonstrativo. Componentes compartilhados fornecem carrosséis, detalhes, menus Radix, notificações e skeletons.

`ChannelList` usa linhas fixas de 76 px e overscan de três linhas. A quantidade montada é limitada pela janela visível, não pelo tamanho do catálogo. Há testes de montagem com 10 mil canais e cálculo de janelas até 50 mil; isso não equivale a benchmark nativo ou orçamento de desempenho aprovado. Virtualização de grids e consultas paginadas de dados reais permanecem para os marcos de catálogo.

Fontes de demonstração têm DTO próprio `DemoSource`, que não é o formato futuro de credenciais. O formulário valida a entrada com o serviço existente e descarta usuário/senha, caminho e query ao salvar um descritor em memória. Nenhuma requisição é realizada. Editar recupera apenas nome/tipo/origem; remover exige confirmação. O armazenamento seguro Windows para fontes reais continua sendo requisito da Fase 3.

Os modelos `Season` e `Episode` ficam no domínio; exemplos determinísticos ficam em `src/demo/`. Seleção de temporada reinicia ao trocar de título. Classificação é opcional e só aparece quando o modelo a fornece. Todos os progressos, programas e títulos de exemplo estão identificados como fictícios.

Versões efetivas estão nos manifests/lockfiles. TypeScript foi fixado em 6.0.3 porque `typescript-eslint` 8.72.0 declara suporte abaixo de 6.1; a consulta inicial a TypeScript 7 permanece acima como histórico, não versão instalada. Rust 1.95.0, crate Tauri 2.12.5 e tauri-build 2.7.4 foram fixados; Cargo.lock gerado. Somente formatting e metadados Rust foram verificados no Linux, sem compilar desktop ou instalar GTK/WebKitGTK.

## Implementação da Fase 3

O núcleo em `core/` e serviços em `services/` implementam parser, rede, SQLite, importação cancelável, proteção DPAPI e cache. Feature `desktop` mantém Tauri somente no Windows; `--no-default-features` permite testar o núcleo sem WebView em Linux. Isso não cria distribuição desktop Linux. Detalhes, limites, decisões e evidências: [docs/PHASE_3.md](docs/PHASE_3.md). A preferência inicial por Credential Manager foi concretizada como DPAPI por usuário para configurações e URLs cifradas no banco; não existe fallback em texto puro. `channels/movies/series` são views tipadas sobre `media_items` para evitar duplicação.

## Biblioteca e navegação contextual — revisão atual

`NativeCatalogBrowser` usa consultas SQLite paginadas (60 registros), subcategorias e filtros por fonte. `NativeDetails` é uma página completa selecionada por ID, com temporadas/episódios; não é modal. A sessão global de reprodução permanece montada ao alternar a TV entre prévia lateral e teatro, reposicionando o mesmo HWND. Sair da TV encerra a prévia. Filmes/séries mantêm a página de detalhes sob a reprodução para voltar à temporada selecionada.

Migração transacional 002 mantém o catálogo existente e acrescenta favoritos, Minha Lista e progresso por mídia/episódio. Atualizações conservam identidade e progresso; remover a fonte limpa registros associados. Progresso só é gravado quando o status do motor corresponde à mídia/episódio atual e tem duração válida; intervalo de cinco segundos e fechamento. A retomada ignora posições abaixo de cinco segundos e os últimos quinze segundos. Não oferece timeshift para TV. Banco v2 exige esta versão ou posterior; não fazer downgrade do executável sobre o mesmo banco.

`thumbnail_for` prioriza imagem de episódio fornecida via Xtream, validada pelo cache existente. Na ausência, `Previews` extrai um PNG verdadeiro via libmpv, sem áudio/janela, limitado a 640×360, um decoder de cada vez, timeout e cancelamento. O comando de reprodução suspende capturas antes de abrir o stream principal. Cache de frames: 64 MiB, sete dias, nomes opacos e escrita temporária. URLs/credenciais permanecem no Rust; nenhuma imagem de terceiros ou vídeo fictício substitui falha. Prévia indisponível tem placeholder explícito. Não há prévias paralelas automáticas de canais: a prévia de TV é o próprio canal selecionado.

## Menu contextual e busca

`CatalogSidebar` carrega categorias reais por tipo/fonte e usa `useCatalogFilters` para compartilhar seleção, fonte e paginação com `NativeCatalogBrowser`. Estado separado por Filmes/Séries, somente em memória. Fonte removida invalida o filtro ao reabrir catálogo. O menu alterna entre seções principais e categorias sem abandonar o catálogo; Início fecha detalhes e navega para home.

A busca global continua consultando todas as fontes, independente dos filtros da página. `overlayOpen` na sessão controla apenas visibilidade da superfície nativa para o diálogo Radix; mudanças de overlay são serializadas com o ciclo de reprodução e não recarregam mídia. Coordenadas e ResizeObserver respeitam esse estado. Escolher detalhes de filme/série encerra uma eventual prévia de TV.

## Controles de tela cheia por inatividade

Em tela cheia com HUD disponível, o cabeçalho e OSC são desenhados no próprio vídeo; o cabeçalho React não reserva altura. `Chrome` envia somente dois booleanos (fullscreen/episódios) ao script confiável. `Wake` sinaliza atividade da interface sem recarregar a mídia. Lua observa movimento dentro do HWND e os atalhos, mostra cabeçalho/OSC e oculta ambos três segundos depois, mesmo pausado. Botões superiores encaminham somente ações fixas para Voltar, tela cheia e painel de episódios; ajustes continuam nativos. Cursor tem prazo de três segundos. Não há alteração de codecs, rede, persistência ou credenciais.

`useIdleControls` cobre o fallback React. Eventos globais de teclado reativam o HUD mesmo quando o foco está no WebView; mouse/teclado do vídeo são tratados no Lua. Painéis React abertos e erros mantêm seus controles acessíveis. Eventos nativos são tratados na consulta assíncrona de status, sem efeitos de estado encadeados. Sair de tela cheia restaura o cabeçalho de navegação e comportamento normal do OSC.
