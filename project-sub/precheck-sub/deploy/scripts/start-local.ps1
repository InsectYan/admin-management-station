# Local stack: postgres + api + frontend
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_utf8.ps1"

$bridge = Join-Path $PSScriptRoot "comfy-bridge.ps1"
$bridgeUp = Get-NetTCPConnection -LocalPort 18787 -State Listen -ErrorAction SilentlyContinue
if ($bridgeUp) {
  Write-Host "ComfyUI start bridge already listening on 18787"
} else {
  $quotedBridge = $bridge.Replace('"', '')
  Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$quotedBridge`""
  Write-Host "ComfyUI start bridge  http://127.0.0.1:18787"
}

Write-Host "==> docker compose up -d --build"
& (Join-Path $PSScriptRoot "compose.ps1") 'up' '-d' '--build'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "precheck stack started"
Write-Host "  Frontend  http://localhost:5104"
Write-Host "  API       http://localhost:5204"
Write-Host "  ComfyUI   stays on the host at http://127.0.0.1:8188"
Write-Host "Stop: ams-precheck local:down"
