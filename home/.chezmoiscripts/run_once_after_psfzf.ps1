# Installs PSFzf (fzf key bindings for PSReadLine; the profile loads it) from the PowerShell Gallery.
$ErrorActionPreference = 'Stop'
if (Get-Module -ListAvailable PSFzf) { exit 0 }
Install-Module PSFzf -Scope CurrentUser -Force
