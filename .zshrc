# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="robbyrussell"

plugins=(git zsh-autosuggestions zsh-syntax-highlighting zsh-completions sudo copypath copyfile jsontools)
autoload -U compinit && compinit

FPATH="$(brew --prefix)/share/zsh/site-functions:${FPATH}"
source $ZSH/oh-my-zsh.sh

export EDITOR='vim'

bindkey "^[[H" beginning-of-line
bindkey "^[[F" end-of-line

export ZSH_AUTOSUGGEST_STRATEGY=(history completion)

alias o="open ." # Open the current directory in Finder

[ -f ~/.kubectl_aliases ] && source ~/.kubectl_aliases
function kubectl() { echo "+ kubectl $@">&2; command kubectl $@; }

source .programlangrc
source .customterminalrc
