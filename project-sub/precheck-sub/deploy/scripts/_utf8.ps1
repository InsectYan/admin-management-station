if ($script:AmsUtf8Initialized) { return }
$script:AmsUtf8Initialized = $true
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = $utf8NoBom
if ($env:OS -match 'Windows') {
  try { [Console]::OutputEncoding = $utf8NoBom; [Console]::InputEncoding = $utf8NoBom } catch {}
  try { & cmd.exe /c chcp 65001 > $null } catch {}
}
