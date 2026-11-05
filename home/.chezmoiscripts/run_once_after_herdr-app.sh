#!/bin/sh
# Installs the Herdr app (and herdr-core, `hc`) with its official installer: Homebrew has no cask
# for it (`brew "herdr"` is the older Herdr TUI). Skips when it is already installed: the app
# keeps itself and herdr-core current. The installer verifies the download's sha256 and the
# app's code signature.
set -eu
if [ -e "$HOME/.local/bin/herdr-app" ]; then
  exit 0
fi
curl -fsSL https://releases.herdr.dev/app/install.sh | sh
