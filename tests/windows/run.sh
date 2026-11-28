#!/bin/bash
# Fresh-Windows test: copies this working tree (uncommitted changes included) to a Windows host over
# SSH and runs tests/windows/sandbox-run.ps1 in Windows Sandbox, a throwaway Windows discarded on
# close. On the host it writes only C:\dotfiles-test and a one-time scheduled task, both removed by
# `run.sh --cleanup`.
# Needs on the host: Windows Pro with the Sandbox feature enabled, OpenSSH server with key login,
# and the user signed in to the desktop (the sandbox opens a window in that session).
# Usage: tests/windows/run.sh user@host [false|true]   (the answer to "Work computer?")
#        tests/windows/run.sh user@host --cleanup
set -euo pipefail
export LC_ALL=C  # the log carries non-UTF-8 bytes (progress bars); BSD sed/grep reject them otherwise
repo=$(cd "$(dirname "$0")/../.." && pwd)
target=${1:?usage: run.sh user@host [false|true|--cleanup]}
mode=${2:-false}
win_user=${target%@*}

# The host's SSH shell is cmd.exe: send PowerShell on stdin rather than fight cmd quoting.
ps() { ssh -o BatchMode=yes "$target" 'powershell -NoProfile -NonInteractive -Command -'; }

stop_sandbox() {
	ps <<'EOF'
$sandbox = { Get-Process -ErrorAction SilentlyContinue | Where-Object Name -like 'WindowsSandbox*' }
# The sandbox shuts itself down when the test ends (sandbox-run.ps1). Killing it from the host is the
# last resort: the next sandbox then fails with "the remote environment is disconnecting".
# One statement per line: `powershell -Command -` reads stdin line by line.
for ($i = 0; ($i -lt 120) -and (& $sandbox); $i++) { Start-Sleep 1 }
if (& $sandbox) { Write-Warning 'sandbox still open after 2 min; force-closing it (close the next one by hand if it errors)'; & $sandbox | Stop-Process -Force; Start-Sleep 20 }
schtasks /Delete /TN dotfiles-test /F 2>$null | Out-Null
exit 0  # nothing to stop or delete is fine
EOF
}

if [ "$mode" = --cleanup ]; then
	stop_sandbox
	ps <<'EOF'
Remove-Item -Recurse -Force C:\dotfiles-test -ErrorAction SilentlyContinue
"C:\dotfiles-test exists: $(Test-Path C:\dotfiles-test)"
"scheduled task exists: $([bool](Get-ScheduledTask -TaskName dotfiles-test -ErrorAction SilentlyContinue))"
EOF
	exit 0
fi

echo "==> Copying the working tree to $target:C:\\dotfiles-test\\repo"
stop_sandbox
ps <<'EOF'
Remove-Item -Recurse -Force C:\dotfiles-test -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force C:\dotfiles-test\repo, C:\dotfiles-test\results | Out-Null
EOF
# .git included: install.ps1 runs from a real clone, and chezmoi's workingTree is its root.
COPYFILE_DISABLE=1 tar -czf - -C "$repo" . | ssh -o BatchMode=yes "$target" 'tar -xzf - -C C:/dotfiles-test/repo'

echo "==> Starting Windows Sandbox (work=$mode) in ${win_user}'s desktop session"
# Copied with scp: `powershell -Command -` runs stdin line by line, so a multi-line string fails there.
wsb=$(mktemp)
trap 'rm -f "$wsb"' EXIT
cat >"$wsb" <<EOF
<Configuration>
  <vGPU>Disable</vGPU>
  <MappedFolders>
    <MappedFolder><HostFolder>C:\dotfiles-test\repo</HostFolder><SandboxFolder>C:\repo</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>C:\dotfiles-test\results</HostFolder><SandboxFolder>C:\results</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>powershell -NoProfile -ExecutionPolicy Bypass -File C:\repo\tests\windows\sandbox-run.ps1 -Work $mode</Command></LogonCommand>
</Configuration>
EOF
scp -q -o BatchMode=yes "$wsb" "$target:C:/dotfiles-test/test.wsb"
launch() {
	ps <<EOF
if (-not (Test-Path C:\dotfiles-test\test.wsb)) { Write-Error 'test.wsb missing'; exit 1 }
# /IT: run in the user's signed-in session, where the sandbox window can open.
schtasks /Create /TN dotfiles-test /TR "C:\Windows\System32\WindowsSandbox.exe C:\dotfiles-test\test.wsb" /SC ONCE /ST 00:00 /IT /RU $win_user /F 2>\$null | Out-Null
schtasks /Run /TN dotfiles-test | Out-Null
EOF
	launched_at=$SECONDS
}
launch

echo "==> Streaming C:\\dotfiles-test\\results\\log.txt (the run takes ~20-40 min)"
shown=0
attempt=1
deadline=$((SECONDS + 5400))
while [ $SECONDS -lt $deadline ]; do
	# Windows Sandbox sometimes fails to start ("the remote environment is disconnecting", cause
	# unknown): no log line within 6 minutes counts as a failed launch, retried up to 3 times.
	if [ "$shown" -eq 0 ] && [ $((SECONDS - launched_at)) -gt 360 ]; then
		if [ $attempt -ge 3 ]; then
			echo "FAIL: the sandbox did not start in $attempt attempts" >&2
			exit 1
		fi
		attempt=$((attempt + 1))
		echo "==> No log after 6 min: closing the sandbox, launch attempt $attempt of 3"
		ps <<'PS'
Get-Process -ErrorAction SilentlyContinue | Where-Object Name -like 'WindowsSandbox*' | Stop-Process -Force
for ($i = 0; ($i -lt 60) -and (Get-Process -ErrorAction SilentlyContinue | Where-Object Name -like 'WindowsSandbox*'); $i++) { Start-Sleep 1 }
Start-Sleep 30
exit 0
PS
		launch
		deadline=$((SECONDS + 5400))
	fi
	out=$(ps <<EOF
\$lines = Get-Content C:\dotfiles-test\results\log.txt -ErrorAction SilentlyContinue
\$lines | Select-Object -Skip $shown
"@@COUNT \$(@(\$lines).Count) DONE \$(if (Test-Path C:\dotfiles-test\results\DONE) { (Get-Content C:\dotfiles-test\results\DONE).Trim() } else { '-' })"
EOF
	) || true
	printf '%s\n' "$out" | grep -v '^@@COUNT' || true
	status=$(printf '%s\n' "$out" | sed -n 's/^@@COUNT \([0-9]*\) DONE \(.*\)$/\1 \2/p' | tr -d '\r')
	[ -n "$status" ] && shown=${status%% *}
	done_code=${status#* }
	if [ -n "$status" ] && [ "$done_code" != - ]; then
		stop_sandbox
		exit "$done_code"
	fi
	sleep 30
done
echo "TIMEOUT: no result after 90 min; the sandbox is still open on the host" >&2
exit 1
