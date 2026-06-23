# Reset dev: down volumes + up main stack
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\_utf8.ps1"

$RepoRoot = Split-Path (Split-Path $PSScriptRoot) -Parent
$MainCompose = Join-Path $RepoRoot "menu-master/docker-compose.yml"

Write-Host "==> docker compose down -v (main stack)"
$env:AMS_COMPOSE_FILE = $MainCompose
& (Join-Path $PSScriptRoot "compose.ps1") down -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> ams local (main)"
& (Join-Path $PSScriptRoot "start-local.ps1")
