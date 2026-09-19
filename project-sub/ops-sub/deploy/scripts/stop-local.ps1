# Stop ops stack + host deploy runner (+ optional legacy egress)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

$RunnerPidFile = Join-Path $PSScriptRoot ".host-deploy-runner.pid"
$EgressPidFile = Join-Path $PSScriptRoot ".host-egress-proxy.pid"
$RunnerPort = if ($env:OPS_HOST_RUNNER_PORT) { $env:OPS_HOST_RUNNER_PORT } else { "1329" }
$EgressPort = if ($env:OPS_HOST_EGRESS_PORT) { $env:OPS_HOST_EGRESS_PORT } else { "1328" }

function Stop-PidFile([string]$PidFile, [string]$Label) {
  if (-not (Test-Path -LiteralPath $PidFile)) { return }
  $procId = (Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($procId) {
    Write-Host "==> stop $Label pid=$procId"
    Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-PortListener([int]$Port, [string]$Label) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn -and $conn.OwningProcess) {
      Write-Host "==> stop $Label on :$Port pid=$($conn.OwningProcess)"
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  } catch { }
}

Write-Host "==> docker compose down"
& (Join-Path $PSScriptRoot "compose.ps1") 'down'
$code = $LASTEXITCODE

Stop-PidFile $RunnerPidFile "host deploy runner"
Stop-PortListener ([int]$RunnerPort) "host deploy runner"
Stop-PidFile $EgressPidFile "host egress proxy"
Stop-PortListener ([int]$EgressPort) "host egress proxy"

exit $code
