# Installs the winget package IDs listed in each Wingetfile given (one per line, # comments), skipping
# the ones already installed: like `brew bundle`, it never upgrades. Exits 1 if any install failed.
# Used by install.ps1 and the zz-wingetfile chezmoi script. Windows PowerShell 5.1 compatible, ASCII.
param([Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$Wingetfile)
# winget writes progress to stderr; under a caller's 'Stop' that would abort the run in PowerShell 5.1.
$ErrorActionPreference = 'Continue'
$failed = @()
foreach ($file in $Wingetfile) {
	$ids = Get-Content -LiteralPath $file | ForEach-Object { ($_ -replace '#.*').Trim() } | Where-Object { $_ }
	foreach ($id in $ids) {
		winget list --exact --id $id --accept-source-agreements --disable-interactivity *> $null
		if ($LASTEXITCODE -eq 0) { Write-Host "ok        $id"; continue }
		Write-Host "install   $id"
		winget install --exact --id $id --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
		if ($LASTEXITCODE) { $failed += $id }
	}
}
if ($failed) { Write-Warning "winget could not install: $($failed -join ', ')"; exit 1 }
