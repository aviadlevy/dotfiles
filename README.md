# dotfiles
Collection of my essential configuration files for easy setup and customization across Unix-like systems

# Installation
- First install git and curl - depends on your OS
- Clone dotfiles
- Run `install.sh`
- Open a new terminal (or run `source ~/.zprofile` on macOS, `source ~/.bashrc` on Linux) so `brew` and `chezmoi` are on PATH
- Optional: set zsh as default shell `chsh -s $(which zsh)`
- Run chezmoi init - `chezmoi init https://github.com/aviadlevy/dotfiles.git`
- Run `chezmoi apply` (also installs `Brewfile`, `Brewfile.only_mac` on macOS, and `Brewfile.work` on a work machine)
