#!/bin/bash

set -efo pipefail

# Homebrew's prefix and the login file that puts it on PATH differ per OS (keep in step with home/dot_zshrc.tmpl).
if [ "$(uname -s)" = "Darwin" ]; then
	brew_bin=/opt/homebrew/bin/brew
	shell_profile=~/.zprofile
else
	brew_bin=/home/linuxbrew/.linuxbrew/bin/brew
	shell_profile=~/.bashrc
fi

# Install Homebrew
if ! command -v brew >/dev/null 2>&1; then
	[ -x "$brew_bin" ] || \
		(echo '🍺  Installing Homebrew' && /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)")
	shellenv_line="eval \"\$($brew_bin shellenv)\""
	grep -qsF "$shellenv_line" "$shell_profile" || printf '\n%s\n' "$shellenv_line" >> "$shell_profile"
	eval "$("$brew_bin" shellenv)"
fi


# Install chezmoi
command -v chezmoi >/dev/null 2>&1 || \
	  (echo '👊  Installing chezmoi' && brew install chezmoi)

if [ -d "$HOME/.local/share/chezmoi/.git" ]; then
	  echo "🚸  chezmoi already initialized"
	    echo "    Reinitialize with: 'chezmoi init https://github.com/aviadlevy/dotfiles.git'"
    else
	      echo "🚀  Initialize dotfiles with:"
	        echo "    chezmoi init https://github.com/aviadlevy/dotfiles.git"
fi

echo ""
echo "Done."
