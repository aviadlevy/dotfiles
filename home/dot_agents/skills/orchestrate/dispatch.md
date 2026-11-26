# Dispatch message

Every assignment carries the same parts in this order. Line 1 is the only line the worker's user
sees in the preview, so it stands alone. The standing rules live in `orchestrated-worker`; the
message points at them instead of restating them.

```
<one sentence: the task and its outcome>

Load orchestrated-worker (re-load it if you were cleared).

Task: <ticket key(s)>, parent <key>. Delivery: <delivery skill>. Review bot: <bot and its re-review command, or none>.
Context: <root cause and evidence so far; what is already decided>
Steps:
1. ...
2. ...
Scope: the smallest change that meets the ticket's Verify line. Anything beyond it (a new mechanism, a second MR, a behaviour change outside the ticket) goes to me as a plan before code; I take it to the user.
Pass criteria (I live-test these): <criteria from the plan, or "no live test: <reason>">
Report back: <checkpoints, e.g. "send me a plan (runner, layout, stubbed edges) before writing much code">
Peers: <worker name and the contract you share with it; omit if none>
Read-only references: <paths>
FORBIDDEN (never read, never copy): <secret and customer-data paths>
```

Send it with `hc send <worker> "<message>"`.

Before sending: every skill the message names must exist in that worker's session (repo-scoped and
plugin skills differ per repo). Name a skill only after checking the worker's skill list (`hc read`
after it loads), or describe the step without the skill.
