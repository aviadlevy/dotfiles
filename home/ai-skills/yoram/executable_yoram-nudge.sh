#!/usr/bin/env bash
# PostToolUse(Bash) hook: after a milestone command (MR create / Jira ticket move),
# nudge Claude to propose a Yoram journal entry. Non-blocking; silent for everything else.

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)

# Match only when the milestone command is actually invoked — at the start of the
# command or right after a shell separator, allowing env-var and rtk prefixes — not
# when the phrase merely appears inside an argument (e.g. a commit message body).
prefix='(^|[;&|])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*(rtk[[:space:]]+)?'

if printf '%s' "$cmd" | grep -Eq "${prefix}glab[[:space:]]+mr[[:space:]]+create([[:space:]]|$)"; then
  action="opened a merge request"
elif printf '%s' "$cmd" | grep -Eq "${prefix}jira[[:space:]]+issue[[:space:]]+move([[:space:]]|$)"; then
  action="moved a Jira ticket"
else
  exit 0
fi

ctx="You just ${action} — a Yoram-worthy milestone. Follow the yoram skill: PROPOSE a one- to two-sentence journal entry and wait for the user to confirm before sending. Do NOT send automatically. Skip if this was a trivial or no-op invocation."

jq -n --arg c "$ctx" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $c}}'
