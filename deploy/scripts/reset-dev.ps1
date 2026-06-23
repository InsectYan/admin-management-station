# Reset dev: down volumes + up + smoke (placeholder until apps exist)
$ErrorActionPreference = "Stop"
Write-Host "==> ams local:down (remove volumes)"
& (Join-Path $PSScriptRoot "compose.ps1") --profile local down -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "==> ams local"
& (Join-Path $PSScriptRoot "start-local.ps1")
