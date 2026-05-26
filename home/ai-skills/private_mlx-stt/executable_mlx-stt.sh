#!/bin/bash
set -eo pipefail

VENV_DIR="${HOME}/.stt-venv"
MODEL="mlx-community/whisper-large-v3-mlx"

LOG_FILE="/tmp/stt_$(date +%Y%m%d_%H%M%S)_$$.log"
log() {
    local level="$1"
    shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE" >&2
}

if [ ! -f "$VENV_DIR/bin/python" ]; then
    log ERROR "Venv not found at $VENV_DIR — run the install script first"
    exit 1
fi

audio_path="${1}"

if [ -z "$audio_path" ]; then
    log ERROR "No audio file provided."
    exit 1
fi

if [ ! -f "$audio_path" ]; then
    log ERROR "File not found: $audio_path"
    exit 1
fi

tmpdir="$(mktemp -d)"
audio_wav="${tmpdir}/audio.wav"

# Convert to wav
if ! ffmpeg -y -loglevel error -i "$audio_path" -ar 16000 -ac 1 -c:a pcm_s16le "${audio_wav}" 2>>"$LOG_FILE"; then
    log ERROR "ffmpeg conversion failed (exit code $?)"
    rm -rf "$tmpdir"
    exit 1
fi

# Run mlx-whisper
if ! "$VENV_DIR/bin/python" -c "
import mlx_whisper
result = mlx_whisper.transcribe('$audio_wav', path_or_hf_repo='$MODEL')
with open('$tmpdir/out.txt', 'w') as f:
    f.write(result['text'])
" >> "$LOG_FILE" 2>&1; then
    exit_code=$?
    log ERROR "mlx-whisper failed (exit code $exit_code)"
    rm -rf "$tmpdir"
    exit $exit_code
fi

# Output results
txt_count=$(find "${tmpdir}" -type f -name "*.txt" | wc -l | tr -d ' ')
if [ "$txt_count" -eq 0 ]; then
    log ERROR "No .txt output files found — transcription may have failed silently"
    rm -rf "$tmpdir"
    exit 1
fi

find "${tmpdir}" -type f -name "*.txt" -exec cat {} \;

rm -rf "${tmpdir}"