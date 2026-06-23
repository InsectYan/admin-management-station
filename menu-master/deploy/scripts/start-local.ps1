# Local stack: infra + API + Frontend (Vite dev，对齐 cartoon local)
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\_utf8.ps1"

$DeployDir = Split-Path -Parent $PSScriptRoot
$AppRoot = Split-Path $DeployDir -Parent

$BackendEnv = Join-Path $AppRoot "backend\.env"
$BackendExample = Join-Path $AppRoot "backend\.env.example"
if (-not (Test-Path $BackendEnv)) {
  if (Test-Path $BackendExample) {
    Copy-Item $BackendExample $BackendEnv
    Write-Host "==> created backend/.env from .env.example"
  }
  Write-Host "    Edit menu-master/backend/.env if needed, then run: ams-main local"
}

$FrontendEnv = Join-Path $AppRoot "frontend\.env.local"
$FrontendExample = Join-Path $AppRoot "frontend\.env.local.example"
if (-not (Test-Path $FrontendEnv) -and (Test-Path $FrontendExample)) {
  Copy-Item $FrontendExample $FrontendEnv
  Write-Host "==> created frontend/.env.local"
}

Write-Host "==> docker compose up -d --build (menu-master)"
& (Join-Path $PSScriptRoot "compose.ps1") up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Local stack started"
Write-Host "  Frontend  http://localhost:5173"
Write-Host "  Main API  http://localhost:7001/api/health"
Write-Host "  PostgreSQL localhost:5432"
Write-Host "  Redis       localhost:6379"
Write-Host ""
Write-Host "Frontend only: ams-main local:frontend"
Write-Host "Infra only:    ams-main local:infra"
Write-Host "Reset:         ams-main local:reset"
Write-Host "Stop:          ams-main local:down"
