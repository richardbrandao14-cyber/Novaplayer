$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $root 'player-runtime'
New-Item -ItemType Directory -Force $destination | Out-Null
$url = 'https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/20261021/mpv-dev-x86_64-20261021-git-e471496c56.7z'
$archive = Join-Path $destination 'mpv-dev-x86_64-20261021-git-e471496c56.7z'
if (-not (Test-Path $archive)) { Invoke-WebRequest -Uri $url -OutFile $archive }
$expected = 'efc719eff3dc5954b4a5efc800632808bcec01cc9034940dd14e5eb7fe9ea633'
if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Falha na integridade do motor de reprodução.' }
& 7z x $archive "-o$destination" -y | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao extrair o motor.' }
$dll = Join-Path $destination 'libmpv-2.dll'
if (-not (Test-Path $dll)) { throw 'DLL esperada ausente.' }
Copy-Item (Join-Path $root 'src-tauri/player/nova-hud.lua') $destination -Force
Copy-Item (Join-Path $root 'LICENSE') $destination -Force
Copy-Item (Join-Path $root 'THIRD_PARTY_NOTICES.md') $destination -Force
# Proveniência fixada; não fazer download de latest ou procurar DLL no PATH.
@'
NOVA PLAYER — teste Windows x64
Extraia TODOS os arquivos antes de abrir nova-player.exe.
A DLL libmpv-2.dll deve permanecer na mesma pasta do executável.
Desative os dados demonstrativos / use Adicionar minha lista real.
Depois da importação, clique no canal, filme ou episódio para assistir.
O vídeo e os controles abrem na mesma janela do NOVA PLAYER.
Tela cheia: F; sair: Esc. Espaço: pausa. Ajustes no HUD ou no cabeçalho.
Não há garantia de compatibilidade com todo provedor, codec ou formato.
'@ | Set-Content -Encoding utf8 (Join-Path $destination 'LEIA-ME.txt')
Write-Output "Motor verificado em $dll"
