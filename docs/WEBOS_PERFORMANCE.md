# webOS 0.4.4 — desempenho medido e limites

Medição inicial em 28/10/2026, Node 24 no ambiente cloud Linux. Não representa rede, decodificação, FPS ou tempo total do aplicativo na LG.

## Gargalo confirmado

A função de montagem de Continue percorria todas as chaves de progresso para cada série: aproximadamente O(catálogo × progresso), com alocação repetida de arrays. O novo índice por parentId faz uma passagem pelo progresso, seguida pelo catálogo: O(catálogo + progresso). Produziu as mesmas 1.000/2.000 correspondências nos cenários abaixo.

| Séries sintéticas | Progressos | Antes, ms | Depois, ms |
| --- | --- | --- | --- |
| 1.000 | 2.000 | 168,37 | 2,85 |
| 10.000 | 2.000 | 1.499,69 | 4,32 |
| 30.000 | 2.000 | 4.483,42 | 8,36 |
| 50.000 | 2.000 | 7.685,11 | 6,44 |

Execuções observadas, sem média estatística; a variação inclui aquecimento do JIT. Outra execução após a correção levou 21,96 ms no caso de 50 mil. Não converter a diferença em promessa de velocidade do app ou da TV. Antes: função no commit 5e4a531. Depois: função atual.

Reproduzir a montagem atual: `npm --prefix platforms/webos-poc run benchmark`. O script usa a função real de collection do código local, dados sintéticos e nenhum servidor externo. Não mede os serviços do proprietário.

## Alterações de renderização

- Removida leitura forçada de offsetWidth para reanimar o banner a cada foco.
- Removidos filtros de brilho e sombras grandes nas imagens em foco; mantidos escala pequena, borda e título legível.
- Rolagem e transformações de foco em 140 ms; preferência de movimento reduzido preservada.
- Requisições de imagens limitadas a três, somente visíveis/perto do viewport; destaque prioritário, cancelamento de nós removidos e timeout de dez segundos. A imagem decorativa local do login é independente dessa fila.
- Catálogo reutilizado entre perfis da mesma fonte; bibliotecas pessoais continuam isoladas.

O teste do scheduler verifica limite, prioridade, visibilidade e cancelamento com rede simulada. Chromium verifica navegação/retomada/50 mil registros com imagens sintéticas. Faltam medir na LG: tempo de início, latência percebida, memória com imagens reais, sessões prolongadas, codecs/4K do provedor e retorno de rede.
