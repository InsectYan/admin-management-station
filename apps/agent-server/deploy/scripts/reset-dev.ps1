$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"
& (Join-Path $PSScriptRoot "compose.ps1") --profile agent down -v
& (Join-Path $PSScriptRoot "start-local.ps1")
