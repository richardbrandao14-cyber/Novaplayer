# NEX — caminho para a LG Content Store

Atualizado em 29/10/2026, revisão do app 81de649 (webOS 0.4.8). Escopo: pesquisa e preparação. Não houve cadastro, contratação, submissão ou publicação.

## O que foi conferido e o que falta confirmar

Código, manifesto, documentação e evidências de QA do NEX foram inspecionados. O proprietário confirmou funcionamento de versões anteriores na LG UM7510PSB; a persistência de sessão da 0.4.8 ainda aguarda confirmação física. Há 36 testes/contratos e regressão Chromium, build leve e verificação estrutural/boot do IPK. Isso não é certificação LG.

As novas tentativas aos portais oficiais retornaram `Tunnel connection failed: 403 Forbidden` neste ambiente. Não foi possível verificar o formulário atual nem as regras autenticadas. Portanto, sequência abaixo é um roteiro de preparação; nomes exatos de campos, cadastro individual/empresa, documentos, taxas, dimensões dos materiais, classificação, política para IPTV, cronograma e países elegíveis devem ser confirmados no portal.

Fontes oficiais para conferência pelo titular:

- Seller Lounge (cadastro e gestão comercial): https://seller.lgappstv.com/
- Documentação webOS TV: https://webostv.developer.lge.com/
- TMDB (condições e atribuição): https://developer.themoviedb.org/docs/faq

## Passo a passo

1. **Habilitar o titular no Seller Lounge.** A conta usada no Developer Mode não comprova habilitação como vendedor. Acessar/cadastrar o responsável, informar país e contatos e conferir termos, modalidade individual/empresa e documentos disponíveis para o Brasil. Não assumir CNPJ obrigatório, gratuidade ou cobrança sem conferir o portal.
2. **Definir a primeira distribuição.** Proposta inicial: Brasil, português e app que reproduz fontes do próprio usuário. Decidir versão gratuita/paga separadamente; publicação não exige que implementemos cobrança por suposição. Confirmar condições comerciais antes de qualquer contratação.
3. **Preparar a identidade do produto.** Verificar uso da marca NEX, descrição e ícones próprios. Definir identidade permanente do aplicativo: manter `com.nex.poc.webos` pode preservar dados se aceito pelo portal; mudar o ID exige plano de migração. O sufixo `poc` não foi verificado como impedimento da LG. Não trocar silenciosamente o ID.
4. **Preparar privacidade e suporte.** Criar política pública e contato de suporte, com URLs reais. Explicar perfis/histórico/favoritos locais, acesso cifrado e entrada automática, exclusão dos dados, consultas ao provedor, imagens de terceiros e TMDB opcional. Não afirmar “nenhum dado sai da TV”: o provedor recebe consultas e credenciais necessárias; imagens/TMDB também geram tráfego. Preencher os formulários de privacidade/classificação que o portal exigir.
5. **Fechar uma versão candidata para a loja.** Validar a 0.4.8 na TV, corrigir falhas restantes e preparar manifesto/versão/metadados finais. O pacote leve já não inclui amostras de mídia e oculta ferramentas de teste. Revisar saída pelo botão Voltar na raiz e ciclo de vida conforme a diretriz vigente. Manter requisitos mínimos e APIs/permissões realmente usadas.
6. **Executar QA físico.** Testar setas/OK/Voltar/ponteiro/teclado virtual, login, sessão após encerrar/reiniciar TV, cinco perfis, imagens, importação/catálogo, reprodução ao vivo/filmes/séries, retomada, interrupção de rede e uso prolongado. Definir aparelhos/versões atendidos; firmware 05.40.97 não identifica por si a versão do webOS. Medir desempenho, não prometer 120 Hz, HDR ou todos os codecs.
7. **Preparar o teste do avaliador.** Fornecer instruções simples e uma fonte de avaliação estável com mídia própria ou autorizada, incluindo TV/filme/série para reproduzir os fluxos. Confirmar se o portal pede credenciais, documentos de direitos ou material adicional. Entregar segredos apenas pelo canal apropriado do portal; nunca no código, screenshots públicos ou README. A lista comercial de terceiro não serve como prova de direitos só porque funciona.
8. **Montar a página do aplicativo.** Nome, descrições, idiomas, categoria, países, classificação, suporte, política de privacidade, ícones e capturas reais nos formatos/tamanhos pedidos no portal. Sem logos Netflix/HBO nem publicidade de catálogo que o NEX não fornece. Não usar capturas de QA com títulos sintéticos como se fossem catálogo comercial.
9. **Submeter para avaliação, após autorização do proprietário.** Enviar IPK candidato e materiais completos, revisar as informações e só então enviar. Este estudo não autoriza clicar em Submeter/Publicar. A LG pode pedir correções ou esclarecimentos; registrar, corrigir e repetir os testes correspondentes antes de reenviar.
10. **Publicar após aprovação e acompanhar.** Conferir disponibilidade/agenda/países oferecidos pelo portal, validar instalação pela loja e acompanhar suporte/atualizações. Aprovação não é garantida e não há prazo confirmado. A distribuição pela loja dispensa Developer Mode para o consumidor.

## Situação do NEX hoje

| Item | Situação observada / próxima ação |
| --- | --- |
| Reprodução e catálogo | Funcionais em testes anteriores do proprietário; fechar o QA físico da versão candidata. |
| Sessão automática | V2 com confirmação de gravação e recuperação; aguarda reabertura física na LG. |
| IPK | Leve (~4 MB), mesmo ID, sem vídeos de QA; ainda descrito como desenvolvimento. |
| Controle e saída | Navegação interna implementada. Voltar na raiz mantém o app aberto; revisar contra diretriz vigente antes da submissão. |
| Compatibilidade | Um modelo informado; identificar webOS real e estabelecer matriz antes de anunciar suporte amplo. |
| Privacidade/suporte | Não há política pública ou contato de suporte integrados no app. Preparar e publicar somente com dados e autorização reais. |
| Marca/material de loja | Identidade NEX e ícones existentes; faltam verificação de marca e materiais finais nos padrões do portal. |
| Conteúdo de avaliação | Falta definir fonte própria/autorizada e instruções estáveis para o avaliador. |
| Licença | Projeto GPL. Preparar avisos e acesso ao código-fonte correspondente/build, e conferir compatibilidade da distribuição proposta. webOS usa o motor da TV; libmpv é da edição Windows. |
| TMDB | Opcional por sessão, com atribuição textual. Conferir condições comerciais e materiais oficiais; não embutir token pessoal. |
| Cadastro/submissão | Não executados; dependem do titular e das exigências atuais do Seller Lounge. |

## Próximo marco concreto

Concluir o teste físico da 0.4.8 e, em paralelo, o titular acessar o Seller Lounge para conferir modalidade de cadastro e exigências brasileiras. Depois preparar a candidata: privacidade/suporte, saída, matriz de compatibilidade, fonte de avaliação e materiais de loja. Somente um conjunto completo e revisável deve seguir para autorização de submissão.
