# Frontend only (Docker container; no infra / api-main)
# API proxy: frontend/.env.local VITE_PROXY_TARGET
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\_utf8.ps1"

$DeployDir = Split-Path -Parent $PSScriptRoot
$AppRoot = Split-Path $DeployDir -Parent

$FrontendEnv = Join-Path $AppRoot "frontend\.env.local"
$FrontendExample = Join-Path $AppRoot "frontend\.env.local.example"
if (-not (Test-Path $FrontendEnv)) {
  if (Test-Path $FrontendExample) {
    Copy-Item $FrontendExample $FrontendEnv
    Write-Host "==> created frontend/.env.local — set VITE_PROXY_TARGET, then: ams-main local:frontend"
    exit 1
  }
  throw "Missing frontend/.env.local (set VITE_PROXY_TARGET)"
}

Write-Host "==> docker compose up main-frontend -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") up main-frontend -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Frontend only (Docker)"
Write-Host "  UI     http://localhost:5173"
Write-Host "  Proxy  frontend/.env.local -> VITE_PROXY_TARGET"
Write-Host ""
Write-Host "Full stack: ams-main local"
Write-Host "Stop:       ams-main local:down"
