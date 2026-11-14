param([ValidateSet('start','stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$demoDirectory = Join-Path $taskRoot '.demo'
$tunnelStatePath = Join-Path $demoDirectory 'tunnel.json'
$executable = Join-Path $demoDirectory 'tools/cloudflared.exe'
$tunnelLog = Join-Path $demoDirectory 'tunnel.log'
$configPath = Join-Path $demoDirectory 'runtime.json'

function Test-OwnedTunnel($saved) {
    if (-not $saved -or -not $saved.pid) { return $false }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$saved.pid)"
    return $process -and $process.ExecutablePath -eq $executable -and $process.CommandLine.Contains($tunnelLog)
}

Push-Location $taskRoot
try {
    $saved = if (Test-Path $tunnelStatePath) { Get-Content $tunnelStatePath | ConvertFrom-Json } else { $null }
    if ($Action -eq 'stop') {
        if (Test-OwnedTunnel $saved) { Stop-Process -Id $saved.pid }
        if (Test-Path $tunnelStatePath) { Remove-Item -LiteralPath $tunnelStatePath }
        & node scripts/demo.mjs stop frontend
        # Windows PowerShell 5.1 removes empty env vars; clear the persisted fallback too.
        $localConfig = Get-Content $configPath | ConvertFrom-Json
        $localConfig.publicOrigin = ''
        [System.IO.File]::WriteAllText($configPath, ($localConfig | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))
        $env:PUBLIC_ORIGIN = ''
        & node scripts/demo.mjs start frontend
        if ($LASTEXITCODE -ne 0) { throw 'Could not restore local frontend.' }
        Write-Output 'Tunnel stopped. Local application remains available.'
        return
    }
    if (Test-OwnedTunnel $saved) { Write-Output $saved.url; return }
    if (-not (Test-Path $executable)) { throw 'Download and verify the official cloudflared executable into .demo/tools first; see README_DEMO.md.' }
    $config = Get-Content $configPath | ConvertFrom-Json
    # Clear only this log before launch, never database or unrelated files.
    Set-Content -LiteralPath $tunnelLog -Value ''
    $arguments = @('tunnel','--no-autoupdate','--protocol','http2','--url',"http://127.0.0.1:$($config.frontendPort)",'--logfile',('"' + $tunnelLog + '"'))
    $tunnel = Start-Process -FilePath $executable -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $demoDirectory 'tunnel-stdout.log') -RedirectStandardError (Join-Path $demoDirectory 'tunnel-stderr.log')
    @{pid=$tunnel.Id;url=$null} | ConvertTo-Json | Set-Content -LiteralPath $tunnelStatePath
    $deadline = (Get-Date).AddSeconds(45)
    $url = $null
    while ((Get-Date) -lt $deadline) {
        if ($tunnel.HasExited) { throw 'Cloudflare tunnel exited; inspect .demo/tunnel-stderr.log.' }
        $logText = (Get-Content $tunnelLog -Raw) + (Get-Content (Join-Path $demoDirectory 'tunnel-stderr.log') -Raw)
        if ($logText -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $url = $Matches[0]; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $url) { throw 'No tunnel URL was returned within 45 seconds.' }
    @{pid=$tunnel.Id;url=$url} | ConvertTo-Json | Set-Content -LiteralPath $tunnelStatePath
    & node scripts/demo.mjs stop frontend
    $env:PUBLIC_ORIGIN = $url
    & node scripts/demo.mjs start frontend
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure authenticated gateway for tunnel origin.' }
    Write-Output "Temporary HTTPS URL: $url"
    Write-Output 'All screens/APIs require the private credentials in .demo/access.json. Verify on another device before presenting.'
} catch {
    if ($Action -eq 'start' -and $tunnel -and -not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id }
    throw
} finally { Pop-Location }
