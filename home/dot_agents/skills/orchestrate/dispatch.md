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
Pass criteria (I live-test these): <criteria from the plan, or "no live test: <reason>">
Report back: <checkpoints, e.g. "send me a plan (runner, layout, stubbed edges) before writing much code">
Peers: <worker name and the contract you share with it; omit if none>
Read-only references: <paths>
FORBIDDEN (never read, never copy): <secret and customer-data paths>
```

Send it with `notify_when_idle: true`.
