# Local stack: postgres + api + frontend
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

Write-Host "==> docker compose up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") 'up' '-d' '--build'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "ops stack started"
Write-Host "  Frontend  http://localhost:5103"
Write-Host "  API       http://localhost:5203"
Write-Host "Stop: ams-ops local:down"
