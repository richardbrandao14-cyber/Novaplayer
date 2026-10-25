# Componentes de terceiros

NOVA PLAYER é licenciado sob GNU GPL versão 3 ou posterior, por autorização do proprietário. Veja LICENSE. A licença não concede direitos sobre conteúdo fornecido por fontes IPTV.

## Motor Windows de teste

- Projeto: mpv / libmpv (GPL versão 2 ou posterior; componentes podem impor GPL versão 3).
- Build x86_64 padrão, sem requisito x86_64-v3: shinchiro/mpv-winbuild-cmake, release `20261021`, mpv `e471496c56`.
- Arquivo: `mpv-dev-x86_64-20261021-git-e471496c56.7z`.
- SHA-256 publicado pelo GitHub e conferido no download: `efc719eff3dc5954b4a5efc800632808bcec01cc9034940dd14e5eb7fe9ea633`.
- Origem: https://github.com/shinchiro/mpv-winbuild-cmake/releases/tag/20261021
- Código do motor: https://github.com/mpv-player/mpv/tree/e471496c56
- Receitas e dependências do build: https://github.com/shinchiro/mpv-winbuild-cmake

O script de preparação conserva o arquivo completo de desenvolvimento, os headers e os dados da release, além da licença GPL e destes avisos. O executável e a DLL devem permanecer juntos. Não há download de DLL em tempo de execução.

A distribuição pública final permanece bloqueada até reunir e revisar o **código-fonte correspondente completo** do build binário (incluindo FFmpeg e bibliotecas transitivas, patches e receitas nas revisões exatas). Os links acima registram a proveniência e não substituem essa obrigação. Este marco é teste privado de desenvolvimento, sem Release ou instalador.

React, Tauri e demais dependências conservam suas licenças próprias. Cargo.lock e package-lock.json fixam as versões utilizadas; revisar os avisos completos antes da distribuição final.
