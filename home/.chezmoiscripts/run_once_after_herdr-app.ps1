# Installs the Herdr app and herdr-core (`hc`) with the official installer (Windows twin of
# herdr-app.sh): no admin, adds itself to the user PATH, checks the download's SHA-256 (no code
# signature check on Windows). x64 only. Skips when installed: the app keeps itself current.
$ErrorActionPreference = 'Stop'
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
  Write-Warning "herdr-app: no Windows build for $env:PROCESSOR_ARCHITECTURE yet (x64 only), skipping"
  exit 0
}
if (Test-Path "$env:LOCALAPPDATA\Programs\herdr-app\herdr-app.exe") { exit 0 }
Invoke-RestMethod https://releases.herdr.dev/app/install.ps1 | Invoke-Expression
