# Local stack: infra + main app (menu-master)
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\_utf8.ps1"

$RepoRoot = Split-Path (Split-Path $PSScriptRoot) -Parent
$MainCompose = Join-Path $RepoRoot "menu-master/docker-compose.yml"

$env:AMS_COMPOSE_FILE = $MainCompose

Write-Host "==> docker compose up -d --build (menu-master)"
& (Join-Path $PSScriptRoot "compose.ps1") up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Local stack started (main app)"
Write-Host "  Main UI     http://localhost:8080"
Write-Host "  Main API    http://localhost:7001/api/health"
Write-Host "  PostgreSQL  localhost:5432"
Write-Host "  Redis       localhost:6379"
Write-Host ""
Write-Host "Full stack:  ams local:all   (novel + agent profiles)"
Write-Host "Infra only:  ams local:infra"
Write-Host "Reset:       ams local:reset"
Write-Host "Stop:        ams local:down"
