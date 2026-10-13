# Local stack: postgres + api + frontend
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

Write-Host "==> docker compose up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") 'up' '-d' '--build'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "cartoon stack started"
Write-Host "  Frontend  http://localhost:5105"
Write-Host "  API       http://localhost:5205"
Write-Host "  ComfyUI   stays on the host at http://127.0.0.1:8188"
Write-Host "Stop: ams-cartoon local:down"
