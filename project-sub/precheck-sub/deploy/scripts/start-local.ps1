# Local stack: postgres + api + frontend
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

Write-Host "==> docker compose up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") 'up' '-d' '--build'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "precheck stack started"
Write-Host "  Frontend  http://localhost:5104"
Write-Host "  API       http://localhost:5204"
Write-Host "  ComfyUI   stays on the host at http://127.0.0.1:8188"
Write-Host "Stop: ams-precheck local:down"
