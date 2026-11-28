#!/bin/bash
# Installs Claude Code with its official native installer (into ~/.local/bin; it keeps itself
# current). Named 00- so it runs before claude-plugins. Skips when claude is already installed.
# pipefail: a failed download must fail this script, or run_once marks it done and never retries.
set -euo pipefail
if command -v claude >/dev/null 2>&1 || [ -e "$HOME/.local/bin/claude" ]; then
  exit 0
fi
curl -fsSL https://claude.ai/install.sh | bash
