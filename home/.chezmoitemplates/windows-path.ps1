# winget updates PATH for new processes only: reload it (plus the native installers' ~\.local\bin)
# so tools installed earlier in this apply are found.
$env:Path = "$HOME\.local\bin;" + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
