# Report discovery drift and available CLI versions; does not install or authenticate anything.
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'scripts/install.mjs') doctor @args
if ($LASTEXITCODE -ne 0) { throw 'Toolkit discovery checks found missing or changed entries.' }
