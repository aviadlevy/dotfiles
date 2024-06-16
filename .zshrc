# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="robbyrussell"
ENABLE_CORRECTION="true"


plugins=(git zsh-autosuggestions zsh-syntax-highlighting zsh-completions sudo copypath copyfile jsontools helm)
autoload -U compinit && compinit

FPATH="$(brew --prefix)/share/zsh/site-functions:${FPATH}"
source $ZSH/oh-my-zsh.sh

export EDITOR='vim'

# enable after installing starship - https://starship.rs/
#eval "$(starship init zsh)"

bindkey "^[[H" beginning-of-line
bindkey "^[[F" end-of-line

export ZSH_AUTOSUGGEST_STRATEGY=(history completion)

alias ll='ls -l --color=tty'
alias o="open ." # Open the current directory in Finder

[ -f ~/.kubectl_aliases ] && source ~/.kubectl_aliases
function kubectl() { echo "+ kubectl $@">&2; command kubectl $@; }

# enable after installing nvm - https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating
# export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
# [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
# [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# pyenv configurations. enable after installaion - https://github.com/pyenv/pyenv?tab=readme-ov-file#installation
# export PYENV_ROOT="$HOME/.pyenv"
# command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"  
# eval "$(pyenv init -)"

# enable after sdkman installation - https://sdkman.io/install
# #THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
# export SDKMAN_DIR="$HOME/.sdkman"
# [[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
