## Shell

The Bash tool runs **zsh**; `/bin/bash` is 3.2 (no `declare -A`).

- Name variables anything but `path` (zsh ties it to `$PATH`), and brace one before a colon:
  `"${b}:src/x"` (`$b:s…` is a zsh modifier).
- zsh does not word-split `$var` and fails on an unmatched glob: build argv as an array, quote
  globs (`--include='*.ts'`), and quote a word starting with `=` (`'===='`).
- A pipe stage's exit code is `${pipestatus[1]}`; `$PIPESTATUS` is always empty.
- In scripts and `$(…)` captures, use `command ls`, `command cat`, `builtin cd`: interactive
  aliases point them at eza, bat and zoxide.

