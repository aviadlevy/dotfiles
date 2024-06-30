# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# To install plugins
#
# git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
# git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
# git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:-${ZSH:-~/.oh-my-zsh}/custom}/plugins/zsh-completions
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
