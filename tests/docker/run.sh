#!/bin/bash
# Fresh-machine test: a clean Ubuntu runs install.sh on this working tree (uncommitted changes
# included) from a clone outside ~/.local/share/chezmoi, applies again, then checks the result.
# Usage: tests/docker/run.sh [false|true]   (the answer to "Work computer?", default false)
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
work=${1:-false}
docker build --platform linux/amd64 -t dotfiles-test -f "$repo/tests/docker/Dockerfile" "$repo/tests/docker"
# -t: zsh's line editor needs a terminal, or the startup check sees "can't change option: zle".
docker run --rm -t --platform linux/amd64 -v "$repo:/src:ro" -e WORK="$work" dotfiles-test bash -c '
  set -uo pipefail
  fail=0
  step() { echo; echo "===== $*"; }
  cp -r /src ~/dotfiles

  step "install.sh"
  ~/dotfiles/install.sh --promptBool "Work computer?=$WORK" \
    --promptString "Email address=t@example.com" --promptString "Username=tester" ||
    { echo "FAIL: install.sh exited $?"; fail=1; }
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"

  step "second apply (must succeed, from the remembered source)"
  chezmoi apply || { echo "FAIL: second apply exited $?"; fail=1; }

  step "pending file changes after two applies (run_after scripts excluded: they run every time)"
  d=$(chezmoi diff --no-pager --exclude=scripts 2>&1)
  [ -z "$d" ] && echo ok || { echo "$d" | head -40; echo "FAIL: not converged"; fail=1; }

  step "tools on PATH in a new zsh"
  for t in zsh git chezmoi bat eza fd fzf gh delta jq lazygit pyenv rg rtk tmux vim yazi zoxide node npm claude playwright-cli herdr-app; do
    zsh -ic "command -v $t" >/dev/null 2>&1 && echo "ok   $t" || { echo "MISS $t"; fail=1; }
  done

  step "interactive zsh starts without errors"
  err=$(zsh -ic exit 2>&1 >/dev/null)
  [ -z "$err" ] && echo ok || { echo "$err" | head -20; echo "FAIL: zsh stderr"; fail=1; }

  echo; [ $fail = 0 ] && echo "ALL PASSED" || echo "SOME CHECKS FAILED"
  exit $fail
'
