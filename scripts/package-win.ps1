# Compila o Screenlet em Release (MinGW), empacota o Qt com windeployqt e gera
# o instalador (Inno Setup) mais o latest.yml que o electron-updater da versão
# Electron lê para se atualizar para esta.
#
#   powershell -ExecutionPolicy Bypass -File scripts\package-win.ps1
#
# Saída em build\dist:
#   Screenlet-Setup-<versão>.exe   instalador
#   latest.yml                     metadados para o electron-updater
#   win\Screenlet\                 app pronto (o que o instalador copia)
#
# Variáveis de ambiente opcionais:
#   QT_DIR      kit do Qt   (padrão: C:\Qt\6.12.0\mingw_64)
#   QT_TOOLS    ferramentas (padrão: C:\Qt\Tools)
#   ISCC        compilador do Inno Setup (padrão: procura nas pastas usuais)
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$QtDir = if ($env:QT_DIR) { $env:QT_DIR } else { 'C:\Qt\6.12.0\mingw_64' }
$QtTools = if ($env:QT_TOOLS) { $env:QT_TOOLS } else { 'C:\Qt\Tools' }
$env:PATH = "$QtTools\mingw1310_64\bin;$QtTools\CMake_64\bin;$QtTools\Ninja;$QtDir\bin;$env:PATH"

$Iscc = $env:ISCC
if (-not $Iscc) {
    $Iscc = @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
              "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
              "$env:ProgramFiles\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $Iscc) { throw 'Inno Setup 6 não encontrado (winget install JRSoftware.InnoSetup).' }

$Version = (Select-String -Path "$Root\CMakeLists.txt" -Pattern 'project\(Screenlet VERSION ([0-9.]+)').Matches[0].Groups[1].Value
$Build = "$Root\build\win-release"
$Dist = "$Root\build\dist"
$App = "$Dist\win\Screenlet"

function Invoke-Native([string]$exe, [string[]]$arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "$exe falhou ($LASTEXITCODE)" }
}

Write-Host "==> Configurando (Release, $Version)"
Invoke-Native cmake @('-S', $Root, '-B', $Build, '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release', "-DCMAKE_PREFIX_PATH=$QtDir")

Write-Host '==> Compilando'
Invoke-Native cmake @('--build', $Build)

Write-Host '==> Montando a pasta do app'
if (Test-Path "$Dist\win") { Remove-Item -Recurse -Force "$Dist\win" }
New-Item -ItemType Directory -Force $App | Out-Null
Copy-Item "$Build\Screenlet.exe" $App
# Layout plano (exe + DLLs + plugins lado a lado), como a versão Electron:
# atalhos e o "iniciar com o Windows" antigos apontam para <pasta>\Screenlet.exe.
Invoke-Native windeployqt @('--release', '--qmldir', "$Root\qml", '--skip-plugin-types', 'qmltooling',
                            "$App\Screenlet.exe")

# A interface só usa o estilo Basic dos Controls: remove os outros.
foreach ($style in 'FluentWinUI3', 'Fusion', 'Imagine', 'Material', 'Universal', 'Windows') {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$App\qml\QtQuick\Controls\$style"
    Remove-Item -Force -ErrorAction SilentlyContinue "$App\Qt6QuickControls2$style.dll", "$App\Qt6QuickControls2${style}StyleImpl.dll"
}

Write-Host '==> Gerando o instalador'
Invoke-Native $Iscc @('/Q', "/DAppVersion=$Version", "/DSourceDir=$App", "/DOutputDir=$Dist", "$Root\installer\screenlet.iss")
$Setup = "$Dist\Screenlet-Setup-$Version.exe"

# latest.yml no formato do electron-builder: a versão Electron instalada só
# precisa disto (e do .exe) na release para oferecer a atualização.
$sha = [Convert]::ToBase64String([Security.Cryptography.SHA512]::Create().ComputeHash([IO.File]::ReadAllBytes($Setup)))
$size = (Get-Item $Setup).Length
$name = Split-Path -Leaf $Setup
$date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$yml = "version: $Version`nfiles:`n  - url: $name`n    sha512: $sha`n    size: $size`npath: $name`nsha512: $sha`nreleaseDate: '$date'`n"
[IO.File]::WriteAllText("$Dist\latest.yml", $yml) # sem BOM

Write-Host '==> Pronto'
'{0,8:N1} MB  {1}' -f ((Get-ChildItem -Recurse $App | Measure-Object Length -Sum).Sum / 1MB), $App
'{0,8:N1} MB  {1}' -f ($size / 1MB), $Setup
"           $Dist\latest.yml"
