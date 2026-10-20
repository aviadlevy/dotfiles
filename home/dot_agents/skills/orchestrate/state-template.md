# Orchestration: <run-name>

Rewrite each section in place to show the current state. Only **Decisions** is append-only.
Secrets and customer data live in scratch; this file only names them on the cleanup list.
After a compaction: read this file, then continue.

## Bindings for this run
- Task source: <epic / ticket list>
- Repos: <repo → main checkout path>
- Orchestrator: workspace <ws>, permission mode <mode>

## Rules the user added
- <rule> (<date>)

## Workers
| Name [ref] | Workspace / surface | Task | Context % | Since |
|---|---|---|---|---|

## Tasks
| Ticket | Title | Blockers | Pass criteria | State |
|---|---|---|---|---|

## Frontier
- <tickets whose blockers are done, in pick order>

## MRs
| MR | Ticket | Owner | sha | CI | Review | Live test | Waiting on |
|---|---|---|---|---|---|---|---|

## Pending for the user
1. <question> — recommend: <option>
2. Window action: go to `<pane>`, type `<words>`

## Decisions (append-only)
- <UTC timestamp> <the user's answer, verbatim enough to act on>

## Cleanup
- <path / container / branch> — <why it exists>
