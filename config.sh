#! /bin/zsh

FOLDERS=(.config/ .config/alacritty/themes)

for folder in $(echo ${FOLDERS[*]});
do
	mkdir -p ~/$(echo $folder)
done

DOTFILES=(.zshrc .kubectl_aliases .vimrc .config/alacritty/alacritty.toml .config/alacritty/themes/night_owl.toml .config/starship.toml .customterminalrc .programlangrc .gitconfig)

for dotfile in $(echo ${DOTFILES[*]});
do
    cp ./$(echo $dotfile) ~/$(echo $dotfile)
done

source ~/.zshrc
