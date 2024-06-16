#! /bin/zsh

DOTFILES=(.zshrc .kubectl_aliases .vimrc .config/starship.toml)

for dotfile in $(echo ${DOTFILES[*]});
do
    cp ./$(echo $dotfile) ~/$(echo $dotfile)
done

source ~/.zshrc
