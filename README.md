# dotfiles
Collection of my essential configuration files for easy setup and customization across Unix-like systems

# Installation
- First install git and curl - depends on your OS
- Clone dotfiles
- Run `install.sh`
- Sometime you'll need to run `source ~/.bashrc` to reload
- Install Brewfile - `brew bundle install`
- Optional: set zsh as default shell `chsh -s $(which zsh)`
- Run chezmoi init - `chezmoi init https://github.com/aviadlevy/dotfiles.git`
- Run `chezmoi apply`
