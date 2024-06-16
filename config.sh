#! /bin/bash

DOTFILES=(.zshrc kubectl_aliases .config/starship.toml)

for dotfile in $(echo ${DOTFILES[*]});
do
    cp ~/dotfiles/$(echo $dotfile) ~/$(echo $dotfile)
done