# Reset dev: down volumes + up main stack
$ErrorActionPreference = "Stop"

. "$PSScriptRoot\_utf8.ps1"

Write-Host "==> docker compose down -v (main stack)"
& (Join-Path $PSScriptRoot "compose.ps1") 'down' '-v'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> ams-main local"
& (Join-Path $PSScriptRoot "start-local.ps1")
