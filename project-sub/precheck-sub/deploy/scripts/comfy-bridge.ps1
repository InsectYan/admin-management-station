# 本机启动桥。预检 API 在容器里，不能直接执行 Windows 上的 ComfyUI。
# 只监听 127.0.0.1。预检容器通过 host.docker.internal 把启动请求转进来。
$ErrorActionPreference = "Stop"

$port = 18787
$token = if ($env:COMFYUI_START_TOKEN) { $env:COMFYUI_START_TOKEN } else { "local-comfy-start" }
$startScript = if ($env:COMFYUI_START_SCRIPT) {
  $env:COMFYUI_START_SCRIPT
} else {
  Join-Path $PSScriptRoot "..\..\..\..\..\ComfyUI.V7\ComfyUI\start-listen.ps1"
}
$startScript = [System.IO.Path]::GetFullPath($startScript)

function Write-Json($response, $status, $payload) {
  $json = $payload | ConvertTo-Json -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $response.StatusCode = $status
  $response.ContentType = "application/json; charset=utf-8"
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.OutputStream.Close()
}

function Test-ComfyRunning {
  $listen = Get-NetTCPConnection -LocalPort 8188 -State Listen -ErrorAction SilentlyContinue
  if ($listen) { return $true }
  $proc = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*run_v039.py*" }
  return [bool]$proc
}

function Start-ComfyUi {
  if (-not (Test-Path -LiteralPath $startScript)) {
    return @{ ok = $false; status = 500; message = "找不到启动脚本: $startScript" }
  }
  if (Test-ComfyRunning) {
    return @{ ok = $true; status = 200; already_running = $true; message = "ComfyUI 已在运行" }
  }
  $arg = '-NoProfile -ExecutionPolicy Bypass -NoExit -File "{0}"' -f $startScript
  Start-Process -FilePath "powershell.exe" -WorkingDirectory (Split-Path -Parent $startScript) -ArgumentList $arg
  return @{ ok = $true; status = 200; already_running = $false; message = "已执行启动指令" }
}

$already = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($already) {
  Write-Host "ComfyUI start bridge already listening on $port"
  exit 0
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://127.0.0.1:${port}/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "ComfyUI start bridge failed to listen on ${port}: $($_.Exception.Message)"
  exit 1
}
Write-Host "ComfyUI start bridge http://127.0.0.1:$port/  script=$startScript"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response
  try {
    $path = $request.Url.AbsolutePath.TrimEnd("/")
    if ($path -eq "") { $path = "/" }
    $given = $request.Headers["x-start-token"]
    if ($request.HttpMethod -eq "GET" -and $path -eq "/health") {
      Write-Json $response 200 @{ ok = $true; comfy_running = (Test-ComfyRunning) }
      continue
    }
    if ($given -ne $token) {
      Write-Json $response 403 @{ ok = $false; message = "启动口令不正确" }
      continue
    }
    if ($request.HttpMethod -eq "POST" -and $path -eq "/start") {
      $result = Start-ComfyUi
      Write-Json $response $result.status @{
        ok = $result.ok
        already_running = [bool]$result.already_running
        message = $result.message
      }
      continue
    }
    Write-Json $response 404 @{ ok = $false; message = "未知路径" }
  } catch {
    try {
      Write-Json $response 500 @{ ok = $false; message = $_.Exception.Message }
    } catch {
      $response.Abort()
    }
  }
}
