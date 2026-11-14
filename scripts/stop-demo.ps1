$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try { & node (Join-Path $PSScriptRoot 'demo.mjs') stop }
finally { Pop-Location }
