# Local stack: DB + Redis + APIs + Frontends + Agent (profile local)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\..")

Write-Host "==> docker compose --profile local up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") --profile local up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Local stack started"
Write-Host "  Main UI     http://localhost:8080"
Write-Host "  Novel UI    http://localhost:8081"
Write-Host "  Main API    http://localhost:7001/api/health"
Write-Host "  Novel API   http://localhost:7002/api/health"
Write-Host "  Agent API   http://localhost:7003/health"
Write-Host "  PostgreSQL  localhost:5432"
Write-Host ""
Write-Host "Infra only:  ams local:infra"
Write-Host "Reset:       ams local:reset"
Write-Host "Stop:        ams local:down"
