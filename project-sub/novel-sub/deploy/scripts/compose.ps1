# Unified Docker Compose entry for ams-novel CLI.
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ComposeArgs
)

. "$PSScriptRoot\_utf8.ps1"

$ErrorActionPreference = "Stop"
$DeployDir = Split-Path -Parent $PSScriptRoot

$ComposeFile = $env:AMS_COMPOSE_FILE
if (-not $ComposeFile) {
  $ComposeFile = Join-Path $DeployDir "docker-compose.yml"
}
if (-not (Test-Path -LiteralPath $ComposeFile)) {
  throw "缺少 compose 文件: $ComposeFile"
}

$EnvLocal = Join-Path $DeployDir "config\.env.local"
$ComposeEnvArgs = @()
if (Test-Path -LiteralPath $EnvLocal) {
  $ComposeEnvArgs = @("--env-file", $EnvLocal)
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& docker version --format "{{.Server.Version}}" 2>&1 | Out-Null
$daemonOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEap

if (-not $daemonOk) {
  Write-Host ""
  Write-Host "无法连接 Docker 引擎。" -ForegroundColor Red
  Write-Host "  Windows：请先启动 Docker Desktop。" -ForegroundColor Yellow
  exit 1
}

$ErrorActionPreference = "Continue"
& docker compose -f $ComposeFile @ComposeEnvArgs @ComposeArgs
exit $(if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 })
