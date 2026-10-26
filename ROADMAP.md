# Marco atual — NOVA Library

O proprietário confirmou reprodução real da Horizon e autorizou o player integrado e as melhorias de TV/filmes/séries. A revisão atual acrescenta páginas próprias, temporadas/episódios visuais, prévia lateral de TV, favoritos/Minha Lista/retomada persistidos. Os limites anteriores de fase abaixo são históricos; a autoridade atual está em AGENTS.md.

Gate web/núcleo aprovado; testes nativos Windows de decodificação, HWND/HUD, imagem real e posição de início aprovados nesta revisão. Conferir build/pacote final em [checkpoint](docs/PLAYBACK_CHECKPOINT.md). Próximo marco: validar no PC Horizon → TV prévia/fullscreen/retorno, filme → favoritos/retomada e série → imagens/temporada/episódio. Medir comportamento e corrigir problemas comprovados antes de novas funcionalidades. Não há autorização para instalador, Release, publicação, serviços pagos ou novos provedores de metadados.

---

## Histórico de planejamento

> Atualização de escopo: proprietário confirmou Horizon funcionando e autorizou NOVA Cinema, vídeo na mesma janela, HUD, um clique e séries organizadas, com referências visuais de streaming. Concluir este marco primeiro. O estudo de melhorias adicionais de usabilidade foi pedido para depois, sem implementação automática. Registros anteriores abaixo são históricos. Evidência atual em docs/PLAYBACK_CHECKPOINT.md.

# Roadmap e gates técnicos

Autorização atual: Windows 10/11 x64, importação real e reprodução com áudio de TV, filmes e episódios. O proprietário confirmou que a mesma fonte Horizon funciona nos três módulos do Smarters; a mensagem antiga do NOVA era genérica e o reteste da versão corrigida está pendente. Prioridade é funcionamento completo desse fluxo; refinamentos visuais ficam para depois. GPL versão 3 ou posterior autorizada. Sem instalador, Release ou publicação.

Fases 0–3 têm implementação e evidências descritas nos relatórios. O recorte de reprodução nativa da Fase 5 foi autorizado explicitamente; usa janela própria e testes Windows antes do build. Isso não encerra os gates manuais de áudio, GPU, estabilidade, provedores ou distribuição. Veja [checkpoint atual](docs/PLAYBACK_CHECKPOINT.md). Os registros históricos abaixo não substituem esta autorização.

| Fase | Entrega | Gate de saída |
| --- | --- | --- |
| 0 | Arquitetura e documentação | Revisão documental e limites explícitos |
| 1 | Base Tauri/React e NOVA UI mínima | Preview, testes, tipos/lint, build web e primeiro build/teste Windows |
| 2 | Oito telas principais com demo isolada | Navegação, estados, acessibilidade e revisão visual |
| 3 | M3U, Xtream e SQLite | Segurança, cancelamento, refresh atômico e testes de integração |
| 4 | Catálogo real | Paginação, virtualização e metadados sem invenção |
| 5 | PoC libmpv e posterior integração | Primeiro aprovar PoC Windows; depois controles reais e estabilidade |
| 6 | EPG, favoritos, histórico e retomada | Persistência, datas e recuperação validadas |
| 7 | Otimização e resiliência | Carga até 50 mil, memória/cache e falhas medidas |
| 8 | Distribuição Windows | Licenças, cadeia de artefatos e instalador manual aprovado |

## Plano de referência da Fase 1 (executada; validação Windows pendente)

1. Reinspecionar checkout e confirmar requisitos oficiais e versões estáveis/peers. Criar apenas dependências da base: React/TypeScript/Vite, Tauri e estilização; ferramentas de teste/lint compatíveis. Adicionar Radix/shadcn, Motion e estado somente conforme uso real. Não introduzir libmpv, integração IPTV ou banco funcional.
2. Fixar Node e Rust, criar manifests e lockfiles. Documentar preparação Windows (Build Tools, SDK, WebView2, MSVC). Configurar preview web independente do Tauri; não instalar pré-requisitos gráficos Linux nem criar build Tauri Linux. Windows 10/11 x64 é o único alvo do produto.
3. Criar estrutura conforme necessidade, shell mínimo, tokens NOVA UI e navegação mínima; fronteira demo/Tauri explícita. O pedido posterior do proprietário autorizou oito telas demonstrativas iniciais na Fase 1, preservadas e refinadas na Fase 2.
4. Configurar TypeScript strict, lint, testes de componente/navegação e backend Rust mínimo. Definir capabilities/CSP restritas e contrato IPC simples sem dados sensíveis.
5. Configurar CI Linux/web e Windows/nativo; executar checks locais disponíveis e registrar separadamente os resultados remotos efetivamente obtidos. Não publicar aplicativo nem gerar instalador de distribuição.
6. Atualizar documentação com comandos testados e salvar install_script/start_skill cloud, quando necessários. Incluir diretórios, inicialização de processos e readiness; não confiar em processos sobreviverem ao snapshot. Não publicar o ambiente automaticamente.
7. Entregar relatório e parar no gate. Se build Windows não puder ser executado, registrar gate pendente em vez de declarar aprovação total.

Aceite mínimo: preview com shell funcional e demo identificada; teste de navegação que detecte falhas; tipos/lint/unitários/build web aprovados; backend Rust testado e Tauri compilado no Windows com evidência. Nenhum requisito de playback nesta fase.

## Registro de riscos

| Risco | Efeito | Mitigação / marco |
| --- | --- | --- |
| HWND/WebView2 e airspace | Controles ocultos/foco incorreto | PoC Windows antes da integração, Fase 5 |
| DLL/ABI/codec e licença libmpv | Crash ou distribuição inviável | Binários rastreáveis, hashes, revisão de licença e matriz de mídia |
| Host cloud Linux | Não executa validação nativa Windows | Usar host para frontend e CI Windows para backend/desktop, Fase 1 |
| Documentação oficial parcialmente bloqueada | Pré-requisitos ainda não confirmados | Reconsultar fontes oficiais antes de instalar |
| Compatibilidade real de versões | Instalação/build podem falhar | Peers + instalação controlada + locks e build na Fase 1 |
| URLs persistidas com tokens | Exposição no banco/cache/logs | Referências opacas, Credential Manager e desenho seguro antes da Fase 3 |
| Provedores heterogêneos e identidade instável | Catálogos quebrados/perda de favoritos | Adaptadores, fixtures de variações e resolução conservadora |
| Listas/XML/imagens hostis | Bloqueio, memória excessiva ou execução indevida | Limites, validação, cancelamento e isolamento de tarefas |
| Crescimento do catálogo/cache | UI lenta e disco cheio | Paginação, virtualização, quota e carga progressiva |
| Windows 10 e drivers variados | Suporte limitado por dependências | Matriz de builds/OS/GPU documentada; verificar suporte real |
| CI sem desktop interativo | Falsa confiança em playback/instalador | Testes Windows manuais agrupados por marco |

## Resultado da Fase 0

Seis documentos essenciais criados; nenhum código funcional ou dependência instalada. Stack tecnicamente plausível, com compatibilidade declarada frontend consultada e risco nativo explícito. Nenhum build ou reprodução validado. A Fase 1 foi autorizada e executada posteriormente; veja o estado atual abaixo.

## Estado após a Fase 2

Interface demonstrativa, busca, navegação, detalhes, favoritos, histórico e fontes em sessão implementados. Regressão web, captura de telas e resultados documentados em TESTING.md. Problemas de seletor de temporada, reset do formulário Xtream e overflow do placeholder em janela estreita corrigidos e cobertos por testes. Não houve reconstrução do projeto, novas permissões nativas ou integrações de fases futuras.

O frontend está disponível para revisão e aprovação visual. O gate nativo da Fase 1 continua pendente: não houve execução do backend Rust/Tauri em Windows, nem CI remota pelo agente. Antes de iniciar a Fase 3, obter autorização explícita, validar esse gate no Windows e revisar o contrato de armazenamento seguro de fontes reais. Fixtures/salvamento em memória não podem ser promovidos a persistência de credenciais por conveniência.

## Estado após a implementação da Fase 3

Fase parcialmente concluída, com núcleo e integração React testados conforme [relatório](docs/PHASE_3.md). Falta executar Windows/Tauri/DPAPI e validar manualmente o executável de teste. O pedido de testar o aplicativo não autoriza reprodução de vídeo nem Fase 4. Envio do código ao GitHub depende de autorização conforme AGENTS.md; workflow e artefato de teste estão preparados, não executados remotamente.

## Gate automatizado Windows aprovado

Em 24/10/2026, a [execução corrigida](https://github.com/richardbrandao14-cyber/Novaplayer/actions/runs/40140035463) concluiu build e testes Windows, incluindo DPAPI e artefato executável. Permanece o teste manual de abertura/importação no computador do proprietário. A Fase 4 segue não autorizada.


## Próxima evolução funcional — após revisão visual NEX

- Próximo episódio: botão imediato, contagem cancelável, preferência de reprodução automática e continuidade entre temporadas quando sequência estiver identificada. Preservar progresso.
- Pular abertura/recapitulação: somente com intervalos confiáveis fornecidos ou definidos; não adotar tempo fixo universal nem prometer detecção ainda não implementada.
- Recomendações locais e explicáveis: consumo/favoritos/feedback + metadados disponíveis, diversidade, opção de desligar e apagar histórico; sem envio externo por padrão.
- Banners: composição automática com imagens reais já apresentada. Classificações lançamentos/em alta exigem datas/popularidade reais. IA para artes depende de estratégia separada de qualidade, direitos, custo e privacidade; não há API integrada nesta etapa.
