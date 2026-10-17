# Local stack: postgres + api + frontend
param(
  [switch]$BridgeOnly
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

$BridgePort = 18787
$BridgeTaskName = "AMS Precheck Comfy Bridge"
$BridgeScript = Join-Path $PSScriptRoot "comfy-bridge.ps1"

function Test-BridgeListening {
  $listen = Get-NetTCPConnection -LocalPort $BridgePort -State Listen -ErrorAction SilentlyContinue
  return [bool]$listen
}

function Install-ComfyBridgeShortcut {
  $startup = [Environment]::GetFolderPath('Startup')
  if (-not $startup) { throw "找不到当前用户的启动目录" }
  $lnkPath = Join-Path $startup "AMS Precheck Comfy Bridge.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($lnkPath)
  $link.TargetPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  $link.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$BridgeScript`""
  $link.WorkingDirectory = Split-Path -Parent $BridgeScript
  $link.WindowStyle = 7
  $link.Save()
  Write-Host "ComfyUI start bridge login shortcut: $lnkPath"
}

function Register-ComfyBridgeTask {
  $arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$BridgeScript`""
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg
  $logon = New-ScheduledTaskTrigger -AtLogOn
  $repeat = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 9999)
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
  Register-ScheduledTask -TaskName $BridgeTaskName -Action $action -Trigger $logon, $repeat -Settings $settings -Force | Out-Null
  Write-Host "ComfyUI start bridge task: $BridgeTaskName"
}

function Start-ComfyBridgeNow {
  if (Test-BridgeListening) {
    Write-Host "ComfyUI start bridge already listening on $BridgePort"
    return
  }
  $outLog = Join-Path $env:TEMP "ams-comfy-bridge.out.log"
  $errLog = Join-Path $env:TEMP "ams-comfy-bridge.err.log"
  $proc = Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $BridgeScript)
  $deadline = (Get-Date).AddSeconds(8)
  do {
    Start-Sleep -Milliseconds 300
    if (Test-BridgeListening) { break }
    if ($proc.HasExited) { break }
  } while ((Get-Date) -lt $deadline)
  if (-not (Test-BridgeListening)) {
    Write-Host "ComfyUI start bridge failed to listen on $BridgePort"
    foreach ($log in @($outLog, $errLog)) {
      if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 20 }
    }
    exit 1
  }
  Write-Host "ComfyUI start bridge  http://127.0.0.1:$BridgePort"
}

$autostart = $false
try {
  Register-ComfyBridgeTask
  $autostart = $true
} catch {
  Write-Host "WARN: scheduled task was not created: $($_.Exception.Message)"
}
if (-not $autostart) {
  try {
    Install-ComfyBridgeShortcut
  } catch {
    Write-Host "WARN: could not install ComfyUI start bridge login shortcut: $($_.Exception.Message)"
  }
}

Start-ComfyBridgeNow
if ($BridgeOnly) { exit 0 }

Write-Host "==> docker compose up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") 'up' '-d' '--build'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "precheck stack started"
Write-Host "  Frontend  http://localhost:5104"
Write-Host "  API       http://localhost:5204"
Write-Host "  ComfyUI   stays on the host at http://127.0.0.1:8188"
Write-Host "Stop: ams-precheck local:down"
