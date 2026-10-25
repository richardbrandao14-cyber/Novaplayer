# NOVA UI

Direção aplicada à interface demonstrativa: aplicativo de mídia premium, escuro, compacto sem poluição. Capturas reais das oito telas e detalhes/busca foram produzidas; isso não substitui revisão visual no WebView2 Windows nem auditoria completa de acessibilidade.

## Tokens iniciais

| Uso | Valor proposto |
| --- | --- |
| Fundo | #101113 |
| Superfície | #191B1F |
| Superfície elevada | #22252A |
| Texto principal | #F3F4F6 |
| Texto secundário | #ADB3BD |
| Acento e foco | #A6B8FA |
| Erro | #F2A5A5 |
| Espaçamento | escala 4, 8, 12, 16, 24, 32, 48 px |
| Raios | 8 px controles, 12 px cartões, 16 px painéis |
| Movimento | 150–250 ms; preferir opacity/transform |

Tipografia: Segoe UI Variable/Segoe UI no Windows, fallback system-ui; nenhuma fonte remota obrigatória. Base 14–16 px; hierarquia por tamanho/peso, evitando excesso de títulos. Validar contraste WCAG AA, inclusive foco e estados, antes de consolidar tokens. Não usar somente cor para comunicar estado.

## Organização visual

Navegação lateral discreta e estável; conteúdo como protagonista. Início usa destaques contidos e trilhos; Ao vivo prioriza canais e programação; filmes/séries usam grades de pôsteres; listas e configurações usam formulários claros sem aparência de dashboard administrativo. Continuar assistindo e favoritos são destinos próprios. Definir largura mínima somente após testar escala/DPI no Windows; permitir reorganização sem corte de ações.

Radix fornece comportamento acessível e shadcn componentes locais adaptáveis à NOVA UI. Não importar uma biblioteca inteira nem preservar aparência padrão por conveniência. Lucide com espessura e dimensões consistentes. Motion somente onde a transição ajuda orientação, nunca para animar milhares de itens.

## Estados e acessibilidade

Cada tela prevê loading, vazio, erro recuperável, indisponível e sucesso; placeholders não inventam capas/metadados. Skeletons reservam proporção e dimensões para evitar saltos. Modo demonstrativo sempre identificado e separado das fontes reais.

Navegação por teclado, foco visível, rótulos acessíveis, diálogos com restauração de foco e ausência de armadilhas. Tooltips não substituem nomes. Controles do player devem reaparecer por teclado; oferecer escape de fullscreen e atalhos documentados. Respeitar `prefers-reduced-motion`, removendo deslocamentos/efeitos não essenciais.

Evitar neon, gradientes dominantes, blur pesado e transparência excessiva. Preferir bordas discretas e contraste de superfícies. Virtualização não pode perder seleção/foco ou tornar ações inacessíveis. A prova visual ocorrerá nas Fases 1–2, com screenshots e inspeção de estados reais.

## Componentes e comportamentos da Fase 2

Tokens de cor e tipografia permanecem. `styles.css` também define elevações discretas e raios de controle/painel. Imagens reservam proporção, têm placeholder e fallback, e o hero tem carregamento prioritário. Cards oferecem detalhes, favorito e menu por botão ou contexto; menus e modais são Radix. Tooltips aparecem no menu compacto também por foco de teclado.

A busca global usa Ctrl+K, agrupamento por tipo, setas/Home/End e Enter. Foco visível e restauração ao fechar modais foram testados. A limpeza de histórico e remoção de fontes exigem confirmação. Notificações usam região aria-live, sem exposição de dados de formulário.

Motion anima somente a opacidade dos contêineres, sem animar listas inteiras. Preferência de movimento reduzido elimina animação de entrada das páginas/hero e transições CSS. Carrosséis também respeitam essa preferência. O menu se torna compacto em até 900 px e permite expansão temporária sobre o conteúdo; a preferência desktop continua persistida.

A área de vídeo e o EPG são estruturas ilustrativas, sempre rotuladas. O botão de prévia apenas explica a indisponibilidade de reprodução; não simula sucesso de playback. SVGs locais são ilustrações abstratas autorais, não capas de obras reais.

## NOVA Crimson — refinamento aprovado em 24/10/2026

A pedido do proprietário, o acento passa a vermelho NOVA (#E52335), com foco claro (#F76775), texto branco nas ações principais, grafite mais profundo e hero de maior escala. Cartões e trilhos ganham presença sem alterar a identidade/estrutura, copiar logotipos ou integrar serviços de streaming. Imagens demonstrativas permanecem locais e identificadas. Estados reduzidos de movimento e foco são preservados.

## NOVA Cinema — biblioteca real

Referências de streaming fornecidas pelo proprietário: destaque amplo, hierarquia centrada na obra, navegação compacta, fileiras de pôsteres e preto predominante. Manter identidade NOVA e vermelho como acento; não reproduzir logotipos nem inventar metadados, recomendações pessoais ou histórico. Hero e capas usam apenas imagens da fonte, com placeholders honestos.

Séries: temporada explícita, cartões de episódio com número, título, descrição/duração quando fornecidas, clique direto e retorno com contexto preservado. Player: fundo preto, cabeçalho discreto e HUD nativo sobre o vídeo; painéis React ficam em área separada para respeitar a composição Windows. OSC usa fade zero e controles sem animações pesadas; o restante respeita movimento reduzido.

## NOVA Library

Catálogos reais de filmes/séries usam destaque amplo, subcategorias discretas e grid de pôsteres. Detalhes são páginas com fundo da fonte e transição para preto; não copiar marcas externas. Série mostra cartões 16:9 com imagem do episódio e título legível, agrupados pela temporada. Menu expandido: ícone/texto; compacto: ícone com nome acessível/tooltip. Barras de rolagem ocultas preservam overflow, roda, touchpad e teclado; não usar `overflow:hidden` para esconder conteúdo navegável. TV mantém categorias e canais visíveis durante prévia. Respeitar movimento reduzido e não inventar elenco/notas/imagens ausentes.
