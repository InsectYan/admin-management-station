# Unified Docker Compose entry（对齐 cartoon-agent deploy/scripts/compose.ps1）
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

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& docker version --format "{{.Server.Version}}" 2>&1 | Out-Null
$daemonOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEap

if (-not $daemonOk) {
  Write-Host ""
  Write-Host "无法连接 Docker 引擎（daemon 未运行或未就绪）。" -ForegroundColor Red
  Write-Host "  Windows：请先启动 Docker Desktop，待状态为 Running 后再执行 ams-main local。" -ForegroundColor Yellow
  exit 1
}

$ErrorActionPreference = "Continue"
& docker compose -f $ComposeFile @ComposeArgs
$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
exit $exitCode
