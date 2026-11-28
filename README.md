# dotfiles
Collection of my essential configuration files for easy setup and customization across macOS, Linux and Windows

# Installation
- macOS/Linux: install git and curl, clone this repo anywhere, run `./install.sh`. It installs
  Homebrew and the base `Brewfile`, applies the dotfiles with chezmoi (asks: work computer, email,
  username), and offers zsh as the login shell. Then open a new terminal.
- Windows: install Git (`winget install Git.Git`), clone this repo, then from a normal, non-admin
  PowerShell run `powershell -ExecutionPolicy Bypass -File .\install.ps1`. It installs the
  `Wingetfile` packages (PowerShell 7, Git, chezmoi and the CLI tools) and applies the dotfiles. The
  terminal is Herdr, the shell PowerShell 7 with oh-my-posh (p10k lean theme); zsh and tmux are not ported. For a Linux
  toolchain, use WSL2 and the Linux steps inside it. Research and sources:
  `docs/research/windows-support.md`.
- `chezmoi apply` also installs `Brewfile.only_mac` on macOS, and `Brewfile.work` (Windows:
  `Wingetfile.work`) on a work machine.
- Work machines clone `workSkillsRepo` (`home/.chezmoidata/work.yaml`) over SSH. Without SSH access
  the apply warns and skips it; set up the key, then rerun `chezmoi apply`.

# Testing
- `tests/docker/run.sh [false|true]` (the work answer): a fresh Ubuntu container runs `install.sh` on this
  working tree (uncommitted changes included), applies a second time, then checks tools and zsh startup.
- `tests/windows/run.sh user@host [false|true]`: the same on Windows, in Windows Sandbox on a host you
  reach over SSH (Windows Pro, Sandbox feature on, you signed in to the desktop). It writes only
  `C:\dotfiles-test` and a one-time scheduled task there; `run.sh user@host --cleanup` removes both.
