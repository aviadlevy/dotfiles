#!/bin/bash
# Sets up a new macOS/Linux machine from this clone: Homebrew, the base Brewfile, then
# `chezmoi init --apply` with this clone as the source. Safe to rerun.
# Extra arguments go to `chezmoi init` (tests/docker/run.sh passes the prompt answers that way).
# NONINTERACTIVE=1 (Homebrew's own switch) skips the login-shell question.
set -eo pipefail

repo=$(cd "$(dirname "$0")" && pwd)

# Homebrew's prefix and the login file that puts it on PATH differ per OS (keep in step with home/dot_zshrc.tmpl).
if [ "$(uname -s)" = "Darwin" ]; then
	brew_bin=/opt/homebrew/bin/brew
	shell_profile=~/.zprofile
else
	brew_bin=/home/linuxbrew/.linuxbrew/bin/brew
	shell_profile=~/.bashrc
fi

if ! command -v brew >/dev/null 2>&1; then
	[ -x "$brew_bin" ] || \
		(echo '🍺  Installing Homebrew' && /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)")
	shellenv_line="eval \"\$($brew_bin shellenv)\""
	grep -qsF "$shellenv_line" "$shell_profile" || printf '\n%s\n' "$shellenv_line" >> "$shell_profile"
	eval "$("$brew_bin" shellenv)"
fi

# The base Brewfile (chezmoi included) goes in before the first apply: templates look tools up
# with lookPath when chezmoi renders them, so the tools must exist on the first apply.
echo '👊  Installing Brewfile'
brew bundle install --file="$repo/Brewfile"

echo '🚀  Applying dotfiles'
chezmoi init --apply --source="$repo" "$@"

zsh_bin=$(command -v zsh || true)
# Only on a terminal: without one, read hits EOF and set -e would fail the finished setup.
if [ -z "${NONINTERACTIVE:-}" ] && [ -t 0 ] && [ -n "$zsh_bin" ] && [ "$(basename "${SHELL:-}")" != zsh ]; then
	read -rp "Make zsh ($zsh_bin) your login shell? [y/N] " answer || answer=
	if [ "$answer" = y ]; then
		grep -qxF "$zsh_bin" /etc/shells || echo "$zsh_bin" | sudo tee -a /etc/shells >/dev/null
		chsh -s "$zsh_bin"
	fi
fi

echo ""
echo "Done. Open a new terminal."
