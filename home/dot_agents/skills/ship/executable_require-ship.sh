#!/bin/sh
# PreToolUse(Bash) guard: a PR/MR opens only through the ship skill.
# Denies every Bash route to a new PR/MR unless this session (or this subagent) loaded `ship`.
# Without jq the guard allows everything: it is a nudge toward the skill, not a security boundary.
. "$HOME/.agents/hooks/cmd-match.sh"

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)

opens_pr() {
  s='[[:space:]]+'
  invokes "$cmd" "(gh${s}pr|glab${s}mr)${s}(create|new)" && return 0
  # git push -o merge_request.create opens a GitLab MR from the push itself.
  invokes "$cmd" "git${s}push${s}.*merge_request\.create" && return 0
  # The pulls / merge_requests collection itself, not a sub-resource such as pulls/7/comments.
  # gh/glab api turn a call into a POST when it carries fields, unless the method is pinned to GET.
  invokes "$cmd" "(gh|glab)${s}api${s}(.*[[:space:]])?['\"]?[^[:space:]]*(pulls|merge_requests)/?['\"]?" || return 1
  printf '%s' "$cmd" | grep -Eq '(-X|--method)[[:space:]=]*GET' && return 1
  printf '%s' "$cmd" | grep -Eq '(-X|--method)[[:space:]=]*POST|[[:space:]](-f|-F|--field|--raw-field|--input)[[:space:]=]'
}
opens_pr || exit 0

transcript=$(printf '%s' "$input" | jq -r '.transcript_path // ""')
agent=$(printf '%s' "$input" | jq -r '.agent_id // ""')
# A subagent must load ship itself; the parent having loaded it earlier, for another PR, does not count.
# transcript_path is the main session's; PreToolUse documents no agent_transcript_path, so fall back to
# shortcut: the layout from the hooks docs' SubagentStop example; revisit if subagent PRs get denied.
if [ -n "$agent" ]; then
  transcript=$(printf '%s' "$input" | jq -r --arg d "${transcript%.jsonl}/subagents/agent-${agent}.jsonl" '.agent_transcript_path // $d')
fi

# A Skill tool call, or the user typing /ship.
grep -Eqs '"skill":"ship"|<command-name>/?ship</command-name>' "$transcript" && exit 0

jq -n '{hookSpecificOutput: {
  hookEventName: "PreToolUse",
  permissionDecision: "deny",
  permissionDecisionReason: "PRs and MRs open through the ship skill. Invoke it now (Skill tool, skill: \"ship\") and follow its steps from the top: ticket, branch, commit, review gate, push, then it opens the PR/MR."
}}'
