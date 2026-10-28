# NEX para LG webOS — estudo de viabilidade

Data da consulta: 28/10/2026. Status: estudo seguido de PoC isolada autorizada em platforms/webos-poc, sem mudar produção Windows ou publicar na loja. Modelo informado: LG UM7510PSB; firmware 05.40.97 (não é a versão da plataforma webOS). Versão da plataforma e execução real ainda precisam de confirmação.

## Conclusão para decisão

É tecnicamente viável criar uma edição NEX para webOS TV. Não é possível instalar/executar o exe Tauri Windows na TV. Reaproveitam-se identidade visual, componentes/dados de domínio independentes de IPC e parte do React/TypeScript; reprodução, persistência, rede, entrada e empacotamento exigem uma integração TV própria.

Para testar fora da loja, o caminho sustentado pelas ferramentas oficiais consultadas é Developer Mode + dispositivo cadastrado por IP/SSH + pacote .ipk + ares-install/ares-launch. Não planejar um instalador genérico por pen drive para TVs LG residenciais. Métodos de Signage/Hotel/soluções empresariais não devem ser extrapolados para webOS TV residencial. A indisponibilidade do portal nesta consulta impede garantir exceções por modelo/firmware ou declarar proibição universal de USB.

Developer Mode é fluxo de desenvolvimento, não proposta de distribuição permanente para clientes. Confirmar no modelo real disponibilidade do app Developer Mode, requisitos de conta, validade/renovação e comportamento de remoção/expiração antes do teste. Não fixar prazo em horas com base em documentação antiga. Distribuição pública deve ser estudada pelo canal oficial da LG e seus requisitos de aprovação, sem promessa de aprovação.

## Arquitetura proposta, sujeita a prova na TV

| Área | Reaproveitar | Adaptação necessária |
| --- | --- | --- |
| Identidade/UI | NEX, tokens, pôsteres, catálogo, componentes React compatíveis | Layout de TV e foco visível por controle remoto; fallback para efeitos/recursos CSS não suportados |
| Reprodução | Contrato conceitual de play/pause/progresso/tracks | Adaptador para mídia web/nativa suportada pelo modelo; não transportar HWND, DLL libmpv Windows ou Tauri IPC |
| Listas | Regras de validação, normalização e contratos | Implementação assíncrona compatível TV para M3U/Xtream; testar CORS, HTTPS, redirecionamentos e origens |
| Persistência | Modelo de biblioteca/favoritos/progresso | Validar IndexedDB/armazenamento disponível e quota; DPAPI e serviços Rust Windows não se aplicam |
| Segurança | Não registrar credenciais/tokens; limites e validação | Reavaliar armazenamento e ciclo de vida das credenciais da TV; não assumir cofre equivalente ao Windows |
| Distribuição | Pipeline de testes e versionamento | appinfo.json/.ipk, ferramentas LG e decisão de canal de distribuição |

HLS/M3U8 real fornecido pelo servidor é um candidato inicial de reprodução; MP4/VOD depende dos codecs. Um endereço .ts não se torna HLS apenas ao trocar a extensão. Contêiner, codecs, áudio, legendas, resolução, DRM e motores web variam por geração. Não prometer compatibilidade universal nem contar com transcodificação local de software.

Não criar proxy de streams como decisão automática: caso CORS/formatos obriguem servidor intermediário, isso altera custo de banda, segurança de credenciais e arquitetura e exige discussão própria. A primeira prova deve avaliar reprodução direta da fonte autorizada.

Design de TV: setas/OK/Voltar e foco previsível, botões e texto legíveis à distância, nenhuma função essencial exclusivamente em hover. Prévias preferencialmente em imagem; múltiplos decoders e blur/transparência precisam de medição no aparelho. Um app web aparentemente correto no navegador desktop não comprova playback na TV.

## Plano de prova de conceito recomendado

1. Identificar modelo, ano, versão webOS, controle e rede da TV de referência.
2. Confirmar/ativar o caminho oficial de desenvolvimento e instalar um .ipk mínimo pela rede.
3. Reproduzir material de teste autorizado com vídeo e som (HLS, filme e episódio), trocar faixas/legendas quando suportadas, pausar/retomar e recuperar falha de rede.
4. Verificar M3U/Xtream diretamente, CORS/HTTPS, limites e armazenamento; não levar credenciais reais para fixtures ou logs.
5. Validar controle remoto e retorno de navegação, consumo de memória e catálogo progressivo.
6. Só após esses gates decidir integração de código compartilhado e escopo da primeira edição webOS. Windows permanece operacional e separado da prova.

## Evidências e limites

| Afirmação | Estado | Evidência consultada |
| --- | --- | --- |
| CLI oficial suporta webOS TV, perfil tv, pacote/instalação/execução | Verificado no repositório oficial | webos-tools/cli README |
| Teste TV requer Developer Mode e dados IP/SSH/passphrase | Verificado no repositório oficial | README seção Testing |
| Empacotamento gera .ipk | Verificado no código oficial | bin/ares-package.js |
| LG distingue perfis TV/OSE/Signage | Verificado no repositório oficial | CLI README |
| USB genérico para instalar na TV residencial | Não estabelecido como caminho suportado | Ferramentas consultadas documentam instalação via dispositivo/rede; exceções específicas não verificadas |
| Prazo atual/renovação exata de Developer Mode | Não verificado oficialmente nesta consulta | Portal LG inacessível; README comunitário confirma existência de renovação, não prazo oficial |
| Codecs/CORS/DRM da TV do proprietário | Não verificado | Modelo e versão ainda desconhecidos; precisa aparelho real |
| Viabilidade de portar React com adaptadores próprios | Proposta técnica | Arquitetura atual NEX e natureza web da plataforma; depende de compatibilidade da geração escolhida |

Fontes efetivamente consultadas:

- LG/webos-tools CLI: https://github.com/webos-tools/cli — README obtido do branch main.
- Código oficial de empacotamento: https://github.com/webos-tools/cli/blob/main/bin/ares-package.js
- Código oficial de instalação: https://github.com/webos-tools/cli/blob/main/bin/ares-install.js
- LG/webOS Studio: https://github.com/webos-tools/webos-studio — README, perfis e comandos TV/SSH.
- Ferramenta comunitária (não oficial LG), alternativa gráfica ao CLI: https://github.com/webosbrew/dev-manager-desktop — README sobre Developer Mode, instalação e renovação.

Tentativas do portal https://webostv.developer.lge.com/develop/getting-started/developer-mode-app e páginas de especificações falharam por HTTP 403 do proxy deste ambiente. Não foram tratadas como páginas consultadas nem usadas para afirmar requisitos atuais específicos. Nenhum software foi instalado e nenhuma TV foi acessada.
