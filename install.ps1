# Sets up a new Windows machine from this clone (Windows twin of install.sh): the Wingetfile
# packages (PowerShell 7, Git and chezmoi included), then `chezmoi init --apply` with this clone as
# the source. Safe to rerun. From a normal, non-admin PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
# Extra arguments go to `chezmoi init`. ASCII only: Windows PowerShell 5.1 misreads UTF-8 without a BOM.
$ErrorActionPreference = 'Stop'

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
	throw 'winget not found: install "App Installer" from the Microsoft Store, then rerun.'
}

# Packages go in before the first apply, as on macOS/Linux: templates look tools up with lookPath
# when chezmoi renders them, and chezmoi runs .ps1 scripts with pwsh when it finds one.
Write-Host '==> Installing Wingetfile'
& "$PSScriptRoot\install-wingetfile.ps1" "$PSScriptRoot\Wingetfile"
# A failed package does not stop the setup: the apply's zz-wingetfile script retries it.
if ($LASTEXITCODE) { Write-Warning 'continuing; the apply retries the failed packages' }

# winget updates PATH for new processes only.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

# The commit-msg hook (strips Claude attribution trailers); its .sh setup script is skipped on Windows.
git -C $PSScriptRoot config core.hooksPath "$PSScriptRoot/.githooks"

Write-Host '==> Applying dotfiles'
chezmoi init --apply "--source=$PSScriptRoot" @args
if ($LASTEXITCODE) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Done. Open Herdr from the Start menu.'
