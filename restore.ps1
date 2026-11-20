# Cross-platform installer compatibility entrypoint. Other shells can run the Node command directly.
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 20+ first.' }
& node (Join-Path $PSScriptRoot 'scripts/install.mjs') install @args
if ($LASTEXITCODE -ne 0) { throw 'Toolkit installation failed. Existing content was preserved; review the error above.' }
