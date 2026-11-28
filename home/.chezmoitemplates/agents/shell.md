## Shell
{{ if eq .chezmoi.os "windows" }}
The Bash tool runs **Git Bash**; the interactive shell is PowerShell 7, and its aliases (`ls`, `cat`,
`cd`) do not apply in the Bash tool.

- Pass Windows paths with forward slashes (`C:/Users/...`); a backslash is an escape in bash.
- Tools installed with winget are `.exe` files on PATH; call them without the extension.
{{- else }}
The Bash tool runs **zsh**; `/bin/bash` is 3.2 (no `declare -A`).

- Name variables anything but `path` (zsh ties it to `$PATH`), and brace one before a colon:
  `"${b}:src/x"` (`$b:s…` is a zsh modifier).
- zsh does not word-split `$var` and fails on an unmatched glob: build argv as an array, quote
  globs (`--include='*.ts'`), and quote a word starting with `=` (`'===='`).
- A pipe stage's exit code is `${pipestatus[1]}`; `$PIPESTATUS` is always empty.
- In scripts and `$(…)` captures, use `command ls`, `command cat`, `builtin cd`: interactive
  aliases point them at eza, bat and zoxide.
{{- end }}
{{- if .work }}
- Before a `docker build` or `docker pull` of an `*.dkr.ecr.*.amazonaws.com` image, log in
  per `aws.ecr` in `~/.agents/work-profile/work-profile.md`.
{{- end }}

