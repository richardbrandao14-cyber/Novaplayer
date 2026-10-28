# NEX — preparação para a loja LG webOS

Levantamento inicial em 28/10/2026. Não é submissão, aprovação da LG nem promessa de aceitação. O proprietário autorizou entregar o pacote de desenvolvimento e estudar publicação; não autorizou publicar na loja ou contratar serviços.

## Evidência e limite da pesquisa

Inspeção do código webOS 0.4.2, commit f1ef6e3, seus testes e manifesto. Tentativas de consultar os portais oficiais abaixo retornaram HTTP 403 do proxy deste ambiente. Portanto, requisitos comerciais atuais, documentos de cadastro, taxas, tamanhos de imagens, países permitidos e regras específicas para IPTV devem ser conferidos no Seller Lounge; não foram confirmados nesta execução. As etapas abaixo são um plano de preparação, e as lacunas do código são observações verificáveis.

- LG Seller Lounge: https://seller.lgappstv.com/
- Documentação webOS TV: https://webostv.developer.lge.com/
- FAQ/licenciamento TMDB: https://developer.themoviedb.org/docs/faq

## Caminho proposto

| Etapa | Situação do NEX / trabalho necessário |
| --- | --- |
| Responsável comercial | Definir titular, contato de suporte e país de distribuição. Cadastrar vendedor no Seller Lounge e confirmar a modalidade disponível para pessoa física/empresa e eventual cobrança. A conta Developer Mode não comprova habilitação como vendedor. |
| Marca e materiais | Conferir disponibilidade da marca NEX, preparar descrição em português, ícones, screenshots reais e instruções de suporte nos formatos atuais do portal. Não usar marcas Netflix/HBO ou anunciar catálogos que o app não fornece. |
| Identidade de produção | O pacote atual conserva com.nex.poc.webos para atualizar testes sem apagar dados. Antes da primeira submissão, definir um ID permanente aceito pelo portal e planejar eventual migração; não trocar silenciosamente o ID atual. |
| Compatibilidade | Confirmar versão real de webOS e browser da UM7510PSB; 05.40.97 é firmware. Definir gerações atendidas e testar em aparelhos representativos. Não prometer compatibilidade com todas as LG. |
| Navegação e ciclo de vida | Validar controle, ponteiro, teclado virtual, foco, retorno, entrada/saída de fullscreen, suspensão e retomada. Na raiz, o código hoje consome Voltar e mantém o app aberto; definir saída/diálogo conforme a diretriz vigente da LG antes de submeter. |
| Reprodução e desempenho | Medir inicialização, memória, rolagem com 1k/10k/30k/50k registros, imagens, sessões prolongadas e recuperação de rede na TV. Confirmar prévia com imagem, troca de canais, VOD, séries, áudio/legendas expostos, HDR/4K apenas nos formatos efetivamente testados. CI/Chromium não certifica hardware LG. |
| Segurança e privacidade | Publicar política de privacidade acessível e contato; explicar listas/credenciais locais, cofre opcional, IDs de biblioteca e pedidos de metadados/imagens a terceiros. Verificar comportamento sem WebCrypto, exclusão de dados, falhas TLS, URLs remotas e limites de memória. Não há política pública integrada atualmente. |
| Conteúdo e licenças | Manter o produto como player de fontes autorizadas. Preparar provas de autorização do material usado na divulgação e do conteúdo fornecido para avaliação. O funcionamento de uma lista em outro player não prova direitos de distribuição. Não anunciar acesso incluído sem os contratos correspondentes. |
| TMDB e GPL | Conferir uso comercial e atribuição/identidade oficial do TMDB antes da loja. Hoje o token é fornecido pelo usuário e fica na sessão; não embutir token pessoal no pacote. Usar somente dados do provedor na primeira versão é uma alternativa sem backend adicional. Projeto GPL: manter licença, avisos e acesso ao código-fonte correspondente/build, e verificar compatibilidade dos termos de distribuição da loja. libmpv é da edição Windows; o webOS usa o motor da TV. |
| Avaliação LG | Preparar IPK de produção, instruções completas e acesso de teste estável/autorizado para o avaliador, conforme o portal solicitar. A arte decorativa do login e os testes locais não substituem um catálogo de avaliação. Submeter somente após autorização do proprietário, responder às observações e repetir os testes dos itens corrigidos. |

## Próximo marco recomendado

1. Instalar e confirmar a versão 0.4.2 na LG do proprietário: login, foco, busca, logos, prévia com imagem, reprodução e Ajustes sem aprisionar na barra.
2. Preparar uma versão candidata para loja: política de privacidade/suporte, saída pela raiz, identidade permanente, avisos de licença e matriz de aparelhos/testes físicos.
3. Conferir os requisitos atuais dentro do Seller Lounge e preencher a lista de documentos/materiais exatos. Só depois preparar uma submissão concreta para aprovação do proprietário.

O pacote entregue agora ainda é de desenvolvimento e depende de Developer Mode. Uma versão aceita e distribuída pela loja usa o fluxo normal da loja e dispensa esse modo para o consumidor. Não estimar prazo, taxa ou aprovação sem confirmação da LG. Nenhum cadastro, serviço pago, sistema de cobrança ou submissão foi executado neste levantamento.
