#!/usr/bin/env bash
# PostToolUse(Bash) hook: after a milestone command (MR create / Jira ticket move),
# nudge Claude to propose a Yoram journal entry. Non-blocking; silent for everything else.

. "$HOME/.agents/hooks/cmd-match.sh"

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)

if invokes "$cmd" 'glab[[:space:]]+mr[[:space:]]+create'; then
  action="opened a merge request"
elif invokes "$cmd" 'jira[[:space:]]+issue[[:space:]]+move'; then
  action="moved a Jira ticket"
else
  exit 0
fi

ctx="You just ${action} — a Yoram-worthy milestone. Follow the yoram skill: PROPOSE a one- to two-sentence journal entry and wait for the user to confirm before sending. Do NOT send automatically. Skip if this was a trivial or no-op invocation."

jq -n --arg c "$ctx" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $c}}'
