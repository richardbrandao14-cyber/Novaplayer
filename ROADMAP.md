# Roadmap e gates técnicos

A solicitação explícita mais recente autoriza somente a Fase 3 e a preparação de teste Windows. O escopo da Fase 1 foi ampliado pelo proprietário para incluir oito telas demonstrativas; a Fase 2 as refina sobre a mesma base. Este plano não autoriza a Fase 3. Cada fase encerra com revisão técnica, evidências e riscos; obter autorização antes de iniciar a próxima.

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
