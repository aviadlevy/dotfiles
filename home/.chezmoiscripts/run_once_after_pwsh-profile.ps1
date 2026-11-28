# Points PowerShell 7's $PROFILE at the managed ~\.config\powershell\profile.ps1. chezmoi does not
# write $PROFILE itself: OneDrive can redirect Documents, so only pwsh knows where it is.
$ErrorActionPreference = 'Stop'
$line = '. "$HOME\.config\powershell\profile.ps1"'
if (-not (Test-Path -LiteralPath $PROFILE)) { New-Item -ItemType File -Force -Path $PROFILE | Out-Null }
if (-not (Select-String -LiteralPath $PROFILE -SimpleMatch $line -Quiet)) { Add-Content -LiteralPath $PROFILE $line }
