# The user PATH as stored: REG_EXPAND_SZ with %VARS% unexpanded. Going through [Environment] alone
# would expand every %VAR% entry and write it back frozen, as a plain string.
function Get-UserPathEntries {
  @((Get-Item HKCU:\Environment).GetValue('Path', '', 'DoNotExpandEnvironmentNames') -split ';' | Where-Object { $_ })
}
function Set-UserPathEntries([string[]]$Entries) {
  $value = $Entries -join ';'
  # SetEnvironmentVariable tells running programs about the change but stores a plain string: restore the type.
  [Environment]::SetEnvironmentVariable('Path', $value, 'User')
  Set-ItemProperty HKCU:\Environment -Name Path -Value $value -Type ExpandString
}
