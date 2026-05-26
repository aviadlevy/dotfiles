#!/usr/bin/env zsh
set -euo pipefail

if [[ -f "$HOME/.env.personal" ]]; then
  set -a
  source "$HOME/.env.personal"
  set +a
fi

msg="${1:?usage: send.sh \"message\"}"
: "${WORK_LAPTOP_TOKEN:?WORK_LAPTOP_TOKEN not set — see SKILL.md}"
: "${BUTLER_HOST:?BUTLER_HOST not set — see SKILL.md}"
: "${BUTLER_PORT:=8787}"

TAILSCALE="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
tailscale_started_by_us=false

cleanup() {
  if [[ "$tailscale_started_by_us" == "true" ]]; then
    "$TAILSCALE" down 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! "$TAILSCALE" status &>/dev/null; then
  "$TAILSCALE" up 2>/dev/null
  tailscale_started_by_us=true
  for _ in {1..15}; do
    "$TAILSCALE" status &>/dev/null && break
    sleep 1
  done
  if ! "$TAILSCALE" status &>/dev/null; then
    echo "Error: Tailscale failed to connect after 15s" >&2
    exit 1
  fi
fi

payload=$(jq -n --arg t "$msg" '{text: $t}')

curl -sS --fail \
  --connect-timeout 5 --max-time 15 \
  -H "X-Token: ${WORK_LAPTOP_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$payload" \
  "http://${BUTLER_HOST}:${BUTLER_PORT}/journal" \
  > /dev/null
