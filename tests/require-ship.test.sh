#!/bin/sh
# Checks the ship guard against hand-made hook inputs. Run from anywhere: sh tests/require-ship.test.sh
set -u
repo=$(cd "$(dirname "$0")/.." && pwd)
hook="$repo/home/dot_agents/skills/ship/executable_require-ship.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# The hook sources $HOME/.agents/hooks/cmd-match.sh; point HOME at the repo copy.
mkdir -p "$tmp/home/.agents/hooks"
cp "$repo/home/dot_agents/hooks/cmd-match.sh" "$tmp/home/.agents/hooks/"

mkdir -p "$tmp/none/subagents" "$tmp/loaded/subagents"
echo '{"x":1}' > "$tmp/none.jsonl"
echo '{"name":"Skill","input":{"skill":"ship"}}' > "$tmp/loaded.jsonl"
echo '{"x":"<command-name>/ship</command-name>"}' > "$tmp/typed.jsonl"
echo '{"name":"Skill","input":{"skill":"ship"}}' > "$tmp/none/subagents/agent-a1.jsonl"
echo '{"x":1}' > "$tmp/loaded/subagents/agent-a2.jsonl"

fails=0
# expect <allow|deny> <transcript-stem> <agent_id> <command>
expect() {
  out=$(jq -nc --arg c "$4" --arg t "$tmp/$2.jsonl" --arg a "$3" \
    '{tool_input:{command:$c},transcript_path:$t} + (if $a == "" then {} else {agent_id:$a} end)' |
    HOME="$tmp/home" sh "$hook" | jq -r '.hookSpecificOutput.permissionDecision // "allow"')
  [ -z "$out" ] && out=allow
  if [ "$out" = "$1" ]; then echo "ok   $1  $4"; else echo "FAIL want $1 got $out  $4"; fails=$((fails + 1)); fi
}

expect allow none "" 'git status'
expect deny  none "" 'gh pr create --base main'
expect deny  none "" 'cd x && glab mr create --yes'
expect deny  none "" 'GH_TOKEN=t rtk gh pr new'
expect deny  none "" 'glab mr new'
expect deny  none "" 'gh api repos/o/r/pulls -f head=x -f base=main'
expect deny  none "" "glab api projects/1/merge_requests -X POST"
expect deny  none "" 'git push -u origin feat -o merge_request.create'
expect allow none "" 'git commit -m "deny gh pr create without ship"'
expect allow none "" "rg 'glab mr create' ."
expect allow none "" 'gh pr list --head x'
expect allow none "" 'gh api repos/o/r/pulls'
expect allow none "" 'gh api repos/o/r/pulls -X GET -f state=open'
expect allow none "" 'gh api repos/o/r/pulls/7/comments -f body=hi'
expect allow none "" 'glab api "projects/:id/merge_requests/3/approvals"'
expect allow loaded "" 'gh pr create'
expect allow typed  "" 'gh pr create'
expect allow none  a1 'gh pr create'
expect deny  loaded a2 'gh pr create'

[ "$fails" -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
