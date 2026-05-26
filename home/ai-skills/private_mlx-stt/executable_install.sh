#!/bin/bash
set -eo pipefail

VENV_DIR="${HOME}/.stt-venv"

command -v ffmpeg || brew install ffmpeg
command -v uv    || brew install uv

# Remove previous venv if exists
if [ -d "$VENV_DIR" ]; then
    echo "Removing existing venv at $VENV_DIR..."
    rm -rf "$VENV_DIR"
fi

echo "Creating persistent venv at $VENV_DIR..."
uv venv "$VENV_DIR" --python 3.11

echo "Installing mlx-whisper..."
uv pip install --python "$VENV_DIR/bin/python" mlx-whisper

echo "Done. Venv ready at $VENV_DIR"