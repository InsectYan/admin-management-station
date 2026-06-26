# Local stack: postgres + api + frontend
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

Write-Host "==> docker compose up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") 'up' '-d' '--build'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Testgen stack started"
Write-Host "  Frontend  http://localhost:5175"
Write-Host "  API       http://localhost:7003"
Write-Host "Stop: ams-testgen local:down"
