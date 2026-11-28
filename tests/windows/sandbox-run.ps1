# Runs inside Windows Sandbox (started by tests/windows/run.sh): a fresh Windows runs install.ps1 on
# a copy of the repo, applies again, then checks the result. Everything goes to C:\results\log.txt;
# C:\results\DONE holds the exit code. Windows PowerShell 5.1 compatible and ASCII only: the sandbox
# has no pwsh until install.ps1 installs it.
param([string]$Work = 'false')
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$log = 'C:\results\log.txt'
$script:fail = 0
function Out-Log([string]$Line) { Add-Content -LiteralPath $log -Value $Line }
function Step([string]$Name) { Out-Log ''; Out-Log "===== $Name" }
function Invoke-Logged([scriptblock]$Block) { & $Block 2>&1 | ForEach-Object { Out-Log "$_" } }
function Update-Path {
	$env:Path = "$HOME\.local\bin;" + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}

Step 'winget (the sandbox has none; a real Windows 11 ships it)'
Invoke-Logged {
	Install-PackageProvider -Name NuGet -Force | Out-Null
	Install-Module -Name Microsoft.WinGet.Client -Force -Repository PSGallery | Out-Null
	Repair-WinGetPackageManager -AllUsers
}
Update-Path
Out-Log "winget: $((Get-Command winget -ErrorAction SilentlyContinue).Source)"

# A clone in the user's home, like a real setup: the mapped repo folder is read-only.
Copy-Item -Recurse C:\repo "$HOME\dotfiles"

Step 'install.ps1'
Invoke-Logged {
	powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\dotfiles\install.ps1" `
		--promptBool "Work computer?=$Work" --promptString 'Email address=t@example.com' --promptString 'Username=tester'
}
if ($LASTEXITCODE) { Out-Log "FAIL: install.ps1 exited $LASTEXITCODE"; $script:fail = 1 }
Update-Path

Step 'second apply (must succeed, from the remembered source)'
Invoke-Logged { chezmoi apply }
if ($LASTEXITCODE) { Out-Log "FAIL: second apply exited $LASTEXITCODE"; $script:fail = 1 }

Step 'pending file changes (scripts excluded: run_after scripts run every time)'
$diff = (chezmoi diff --no-pager --exclude=scripts 2>&1 | Out-String).Trim()
if ($diff) { Out-Log $diff; Out-Log 'FAIL: not converged'; $script:fail = 1 } else { Out-Log 'ok' }

Step 'source dir remembered'
$src = (chezmoi source-path 2>&1 | Out-String).Trim()
if (($src -replace '/', '\') -eq "$HOME\dotfiles\home") {  # chezmoi prints C:/...
 Out-Log 'ok' } else { Out-Log "FAIL: $src"; $script:fail = 1 }

Step 'tools on PATH in a new pwsh (profile loaded)'
$tools = 'pwsh', 'git', 'chezmoi', 'bat', 'eza', 'fd', 'fzf', 'gh', 'delta', 'jq', 'lazygit', 'rg', 'rtk', 'vim', 'yazi',
	'zoxide', 'uv', 'fnm', 'oh-my-posh', 'node', 'npm', 'claude', 'playwright-cli', 'herdr-app', 'hc'
$found = pwsh -NoLogo -Command "foreach (`$t in '$($tools -join "','")') { if (Get-Command `$t -ErrorAction SilentlyContinue) { `$t } }" 2>$null
foreach ($t in $tools) {
	if ($found -contains $t) { Out-Log "ok   $t" } else { Out-Log "MISS $t"; $script:fail = 1 }
}

Step 'interactive pwsh starts without errors'
$err = (pwsh -NoLogo -Command 'exit' 2>&1 | Out-String).Trim()
if ($err) { Out-Log $err; Out-Log 'FAIL: profile stderr'; $script:fail = 1 } else { Out-Log 'ok' }
$profilePath = (pwsh -NoLogo -NoProfile -Command '$PROFILE' | Out-String).Trim()
if (Select-String -LiteralPath $profilePath -SimpleMatch '.config\powershell\profile.ps1' -Quiet) { Out-Log "ok   `$PROFILE dot-sources the managed profile" } else { Out-Log "FAIL: $profilePath does not load the profile"; $script:fail = 1 }

Step 'claude settings, skills, rtk'
try {
	$s = Get-Content "$HOME\.claude\settings.json" -Raw | ConvertFrom-Json
	if ($s.permissions.defaultMode -eq 'auto' -and @($s.enabledPlugins.PSObject.Properties).Count -eq 2) { Out-Log 'ok   settings.json' } else { throw 'unexpected content' }
} catch { Out-Log "FAIL: settings.json: $_"; $script:fail = 1 }
$skills = Get-ChildItem "$HOME\.claude\skills" -ErrorAction SilentlyContinue
Out-Log "skills: $(($skills | ForEach-Object { "$($_.Name)[$($_.LinkType)]" }) -join ' ')"
if (-not ($skills | Where-Object { $_.Name -eq 'ship-it' -and $_.LinkType -eq 'Junction' })) { Out-Log 'FAIL: ship-it skill not linked'; $script:fail = 1 }
Invoke-Logged { claude plugin list }
$rtk = "$env:APPDATA\rtk\config.toml"
if ((Test-Path $rtk) -and (Select-String -LiteralPath $rtk -SimpleMatch 'glab api' -Quiet)) { Out-Log 'ok   rtk config' } else { Out-Log "FAIL: $rtk"; $script:fail = 1 }

Step 'user PATH, font, Herdr config'
if (([Environment]::GetEnvironmentVariable('Path', 'User') -split ';') -contains "$HOME\.local\bin") { Out-Log 'ok   ~\.local\bin on the user PATH' } else { Out-Log 'FAIL: ~\.local\bin not on the user PATH'; $script:fail = 1 }
# Herdr's settings.json names this family; the font package must register it.
$fonts = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts', 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts' |
	ForEach-Object { (Get-ItemProperty $_ -ErrorAction SilentlyContinue).PSObject.Properties.Name }
if ($fonts -like 'JetBrainsMono NFM *') { Out-Log 'ok   font JetBrainsMono NFM' } else { Out-Log "FAIL: font not registered; JetBrains entries: $(($fonts -like 'JetBrains*') -join ', ')"; $script:fail = 1 }
$herdr = "$HOME\.config\herdr-app\settings.json"
if ((Test-Path $herdr) -and (Select-String -LiteralPath $herdr -SimpleMatch 'JetBrainsMono NFM' -Quiet)) { Out-Log 'ok   Herdr settings.json' } else { Out-Log "FAIL: $herdr"; $script:fail = 1 }

Out-Log ''
if ($script:fail) { Out-Log 'SOME CHECKS FAILED' } else { Out-Log 'ALL PASSED' }
Set-Content -LiteralPath C:\results\DONE -Value $script:fail
# Close the sandbox from inside: a sandbox killed from the host leaves the next one failing with
# "the remote environment is disconnecting".
shutdown.exe /s /t 5
