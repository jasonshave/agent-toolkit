# The repository is the master. Rebuild portable resources, then update managed local installs.
# Never copy home-directory files back over tracked work.
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'scripts/build.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
& node (Join-Path $PSScriptRoot 'scripts/install.mjs') install @args
if ($LASTEXITCODE -ne 0) { throw 'Install failed; review conflicts before using --replace.' }
