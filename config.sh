#! /bin/zsh

DOTFILES=(.zshrc .kubectl_aliases .config/starship.toml)

for dotfile in $(echo ${DOTFILES[*]});
do
    cp ./$(echo $dotfile) ~/$(echo $dotfile)
done

source ~/.zshrc
