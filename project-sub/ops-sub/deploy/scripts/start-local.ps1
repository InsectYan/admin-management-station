# Local stack: postgres + api + frontend + host deploy runner (Windows network = fitness-cli)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

$RunnerJs = Join-Path $PSScriptRoot "host-deploy-runner.cjs"
$RunnerPidFile = Join-Path $PSScriptRoot ".host-deploy-runner.pid"
$RunnerPort = if ($env:OPS_HOST_RUNNER_PORT) { $env:OPS_HOST_RUNNER_PORT } else { "1329" }

# Optional legacy CONNECT proxy (opt-in only; not started by default)
$EgressJs = Join-Path $PSScriptRoot "host-egress-proxy.cjs"
$EgressPidFile = Join-Path $PSScriptRoot ".host-egress-proxy.pid"
$EgressPort = if ($env:OPS_HOST_EGRESS_PORT) { $env:OPS_HOST_EGRESS_PORT } else { "1328" }
$StartEgress = $env:OPS_HOST_EGRESS_ENABLED -match '^(1|true|yes|on)$'

function Test-LocalPort([int]$Port) {
  try {
    return (Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
  } catch {
    return $false
  }
}

function Start-HostDeployRunner {
  if (-not (Test-Path -LiteralPath $RunnerJs)) {
    Write-Host "WARN: missing $RunnerJs — Docker Desktop AgentRun may fail without host runner"
    return
  }
  if (Test-LocalPort ([int]$RunnerPort)) {
    Write-Host "==> host deploy runner already on :$RunnerPort"
    return
  }
  Write-Host "==> start host deploy runner :$RunnerPort (s deploy on Windows network, same as fitness-cli)"
  $proc = Start-Process -FilePath "node" -ArgumentList @($RunnerJs) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $RunnerPidFile -Value $proc.Id -Encoding ascii
  Start-Sleep -Milliseconds 500
  if (-not (Test-LocalPort ([int]$RunnerPort))) {
    Write-Host "WARN: host deploy runner failed to listen on :$RunnerPort"
  } else {
    Write-Host "  host-runner http://127.0.0.1:$RunnerPort (container: host.docker.internal:$RunnerPort)"
  }
}

function Start-HostEgressProxy {
  if (-not $StartEgress) { return }
  if (-not (Test-Path -LiteralPath $EgressJs)) { return }
  if (Test-LocalPort ([int]$EgressPort)) {
    Write-Host "==> host egress proxy already on :$EgressPort (legacy opt-in)"
    return
  }
  Write-Host "==> start host egress proxy :$EgressPort (legacy OPS_HOST_EGRESS_ENABLED=1)"
  $proc = Start-Process -FilePath "node" -ArgumentList @($EgressJs) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $EgressPidFile -Value $proc.Id -Encoding ascii
}

Start-HostDeployRunner
Start-HostEgressProxy

Write-Host "==> docker compose up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") 'up' '-d' '--build'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "ops stack started"
Write-Host "  Frontend     http://localhost:5103"
Write-Host "  API          http://localhost:5203"
Write-Host "  Host runner  :$RunnerPort (auto: container FC TLS 失败时改走宿主机执行，等同 fitness-cli)"
Write-Host "Stop: ams-ops local:down"
