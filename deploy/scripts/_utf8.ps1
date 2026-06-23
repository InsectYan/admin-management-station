# Shared UTF-8 console init for deploy/scripts (ASCII-only source; safe without BOM).
# Dot-source at the top of every user-facing .ps1: . "$PSScriptRoot\_utf8.ps1"

if ($script:AmsUtf8Initialized) {
    return
}
$script:AmsUtf8Initialized = $true

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = $utf8NoBom

if ($env:OS -match 'Windows') {
    try {
        [Console]::OutputEncoding = $utf8NoBom
        [Console]::InputEncoding = $utf8NoBom
    }
    catch {
        # Older hosts may not expose Console encoding APIs.
    }
    try {
        & cmd.exe /c chcp 65001 > $null
    }
    catch {
        # Non-fatal if chcp is unavailable.
    }
}
