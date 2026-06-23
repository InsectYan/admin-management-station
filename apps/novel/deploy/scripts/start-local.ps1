# Local stack: infra + novel (profile novel)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

Write-Host "==> docker compose --profile novel up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") --profile novel up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Novel stack started"
Write-Host "  Frontend  http://localhost:8081"
Write-Host "  API       http://localhost:7002"
Write-Host "Stop: ams-novel local:down"
