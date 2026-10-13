$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"
Write-Host "==> docker compose down -v"
& (Join-Path $PSScriptRoot "compose.ps1") 'down' '-v'
& (Join-Path $PSScriptRoot "start-local.ps1")
