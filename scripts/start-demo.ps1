$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try { & node (Join-Path $PSScriptRoot 'demo.mjs') start; if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar. Confira as mensagens e .demo/*.log.' } }
finally { Pop-Location }
