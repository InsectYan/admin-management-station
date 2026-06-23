$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

Write-Host "==> docker compose --profile agent up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") --profile agent up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Agent stack started"
Write-Host "  Agent API  http://localhost:7003"
Write-Host "Stop: ams-agent local:down"
