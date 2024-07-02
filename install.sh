#!/bin/bash

set -eufo pipefail

echo ""
echo "🤚  This script will setup .dotfiles for you."
read -n 1 -r -s -p $'    Press any key to continue or Ctrl+C to abort...\n\n'


# Install Homebrew
command -v brew >/dev/null 2>&1 || \
	(echo '🍺  Installing Homebrew' && /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	
command -v brew >/dev/null 2>&1 || \
	(echo; echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"') >> ~/.bashrc);

command -v brew >/dev/null 2>&1 || \
	eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

source ~/.bashrc

# Copy Brewfile
echo '    Copying Brewfile' && cp ./Brewfile ~/Brewfile

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
