$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"
Write-Host "==> docker compose --profile novel down -v"
& (Join-Path $PSScriptRoot "compose.ps1") --profile novel down -v
& (Join-Path $PSScriptRoot "start-local.ps1")
