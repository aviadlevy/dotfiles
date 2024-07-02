#!/bin/bash

set -eufo pipefail

which -s brew
if [[ $? != 0 ]] ; then
	echo "🚸  brew is not installed"
	echo "    please install brew again and then run:"
	echo "    brew bundle install"

else
	brew update
	brew bundle install --file=~/Brewfile
fi
