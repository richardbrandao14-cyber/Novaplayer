# Continuar o NEX no Windows com Codex

## Repositório e branch

- Repositório: https://github.com/richardbrandao14-cyber/Novaplayer
- Branch para continuar: **work**.
- Base antes de salvar os trabalhos pendentes: `1a67d4f` (webOS 0.4.12).
- Não houve merge em `main`; a branch work preserva os trabalhos Windows e webOS juntos.

## 1. Preparar o PC

Para trabalhar na interface webOS, instale **Git para Windows**, **Node.js 24.x x64** (referência do projeto: `.nvmrc`, 24.19.0) e o editor/aplicativo em que usa Codex. Não use Node 25/26: package.json exige a série 24.

Downloads oficiais: https://git-scm.com/download/win e https://nodejs.org/en/download. Após instalar, abra um PowerShell novo e confira:

```powershell
git --version
node --version
npm.cmd --version
```

Os comandos usam `npm.cmd` para evitar bloqueio do arquivo npm.ps1 pela política de scripts do PowerShell. Não precisa alterar a política global.

## 2. Clonar e abrir no Codex

No PowerShell, dentro da pasta onde quer guardar o projeto:

```powershell
git clone --branch work https://github.com/richardbrandao14-cyber/Novaplayer.git
cd Novaplayer
git branch --show-current
git status
npm.cmd ci
```

A branch deve ser `work`. Abra a pasta **Novaplayer inteira** no Codex/editor, não só uma subpasta. Primeiro peça ao Codex para ler `AGENTS.md` e este documento. Não use reset, clean ou merge para iniciar. Se o GitHub pedir autenticação, use o fluxo normal do Git Credential Manager.

Prompt sugerido para continuar:

> Leia AGENTS.md e docs/CONTINUAR_NO_WINDOWS.md. Confira git status e trabalhe na branch work. Estamos refinando a edição LG webOS 0.4.13: rolagem contínua, navegação entre fileiras e foco laranja no menu. Preserve também o desktop Windows salvo nesta branch. Não faça merge, publicação ou apague arquivos. Separe validação de navegador de teste na LG.

## 3. Desenvolver a edição LG webOS no PC

Esta é a edição que vinha sendo testada na TV. Não precisa de Rust para a prévia:

```powershell
npm.cmd --prefix platforms/webos-poc ci --ignore-scripts
npm.cmd run webos:build
npm.cmd run webos:preview
```

Abra **http://127.0.0.1:5174** no navegador. Use as setas/Enter/Esc para simular o controle; o comportamento de vídeo/codec da LG ainda exige a TV física. Pressione Ctrl+C no terminal para encerrar. Esta prévia não é a interface React do desktop. Não pede nem inclui lista real no repositório.

Arquivos principais: `platforms/webos-poc/app/`. Após editar, execute `npm.cmd run webos:build` em outro terminal e atualize a página. O preview serve o pacote compilado; não tem atualização automática do código-fonte.

Para gerar o IPK leve de teste:

```powershell
npm.cmd --prefix platforms/webos-poc run build:tv
```

Saída: `platforms/webos-poc/dist/com.nex.poc.webos_0.4.13_all.ipk`. Instale pelo Dev Manager mantendo o mesmo ID e sem desinstalar para preservar dados. Passos completos em `platforms/webos-poc/README.md`. Os comandos de CI usam Chromium/Playwright; esses testes não substituem a LG.

## 4. Interface React do desktop Windows

A raiz também contém a outra edição do produto. Para sua demonstração em navegador:

```powershell
npm.cmd run dev
```

Abra **http://localhost:1420**. Aqui a reprodução nativa e acesso a fontes dependem do Tauri; navegador sozinho é demonstração.

## 5. Executar Tauri com vídeo/áudio nativo no Windows

Somente para desenvolver a edição desktop. Instale também:

1. Visual Studio Build Tools com **Desenvolvimento para desktop com C++**, ferramentas MSVC x64 e Windows 10/11 SDK.
2. Rust via https://rustup.rs/, usando toolchain **x86_64-pc-windows-msvc**. `rust-toolchain.toml` fixa Rust 1.95.0; rustup seleciona essa versão no projeto.
3. Microsoft Edge WebView2 Runtime (normalmente já presente no Windows 10/11).
4. 7-Zip x64 de https://www.7-zip.org/.

Abra um PowerShell novo dentro de Novaplayer. Com 7-Zip no local padrão:

```powershell
$env:Path += ";$env:ProgramFiles\7-Zip"
rustup show
7z i
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-player.ps1
New-Item -ItemType Directory -Force .\src-tauri\target\debug | Out-Null
Copy-Item .\player-runtime\libmpv-2.dll .\src-tauri\target\debug\
Copy-Item .\player-runtime\nova-hud.lua .\src-tauri\target\debug\
npm.cmd run desktop:dev
```

O script baixa a versão fixada de libmpv do GitHub e verifica SHA-256; nunca substituir por uma DLL aleatória. A DLL e o HUD precisam estar **ao lado do executável**, inclusive em desenvolvimento. Os caminhos acima assumem o target padrão; se configurar CARGO_TARGET_DIR ou --target, adapte-os. O comando PowerShell Bypass vale somente para esse processo. Se rodou Vite da seção anterior, encerre-o antes: Tauri inicia seu próprio servidor na porta 1420.

Para build portátil sem instalador:

```powershell
npm.cmd run desktop:build
Copy-Item .\player-runtime\libmpv-2.dll .\src-tauri\target\release\
Copy-Item .\player-runtime\nova-hud.lua .\src-tauri\target\release\
```

Executável: `src-tauri/target/release/nova-player.exe`. Para distribuir, seguir LICENSE/THIRD_PARTY_NOTICES e as regras do projeto; estes comandos não publicam nem geram instalador.

## 6. Verificações e estado entregue

```powershell
npm.cmd run check
npm.cmd run test:e2e
npm.cmd --prefix platforms/webos-poc test
npm.cmd run rust:core
```

Testes E2E precisam de Chromium do Playwright: `npx.cmd playwright install chromium` no Windows. Os comandos Linux com NOVA_CHROMIUM_PATH não devem ser copiados para PowerShell.

Na preparação cloud: TypeScript, lint, 37 testes frontend, 17 cenários E2E e build React passaram após corrigir o componente de prévia ausente e a prop opcional dos favoritos. O componente novo mostra metadados/capa; não apresenta vídeo ou trailer falso. A integração de storyboard Windows continua em andamento. Novos comandos de feedback/conexão foram alinhados ao allowlist Tauri.

O código Windows pendente inclui avaliações, separação de favoritos, indicador de consulta à fonte e infraestrutura de storyboard. Não declarar essas funções aprovadas na aplicação nativa sem executar o build/testes MSVC. Cargo/Rust não estava disponível neste executor cloud; os testes Rust/desktop deverão ser executados no Windows ou no CI.

A edição webOS passou nos testes unitários e na regressão Chromium com catálogo de 50 mil registros, mídia sintética e controle. O comando de prévia webOS também foi iniciado e verificado por HTTP.

A edição webOS 0.4.13 inclui otimização de foco/rolagem ainda não confirmada na TV física. A última versão confirmada pelo proprietário foi 0.4.12. Antes de gerar novo pacote de uso, repetir o teste de navegação e verificar o menu laranja na LG. Nunca confundir os números de versão webOS com o 0.1.0 técnico do Tauri.

Arquivos gerados (`node_modules`, dist, src-tauri/target, player-runtime) não ficam no Git: são recriados pelos comandos acima. O código, lockfiles, migrations, assets de interface e fixtures de teste permanecem versionados. Dados pessoais da TV/PC e credenciais não fazem parte da clonagem.

## 7. Pendências de loja e licenças

Não houve publicação na LG. Preparação em `docs/WEBOS_STORE_READINESS.md`. Os logos adicionais brasileiros têm condições de origem ainda não confirmadas por arquivo para distribuição comercial; revisar antes da loja, conforme `docs/CHANNEL_LOGOS.md`. Não incorporar tokens TMDB ou credenciais em código/commits.
