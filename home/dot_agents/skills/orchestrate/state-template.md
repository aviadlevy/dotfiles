# Orchestration: <run-name>

Rewrite each section in place to show the current state. Only **Decisions** is append-only.
Secrets and customer data live in scratch; this file only names them on the cleanup list.
After a compaction: read this file, then continue.
The Herdr work-board mod reads the tables: a worker's Name is its hc `--name` when you created it,
and the MR Owner repeats the Name; Task holds ticket keys; in Waiting on, separate parallel waits with `;` and start the
user's own with `user:` (`CI; user: aws sso login`). A ticket shows as in flight once its State says dispatched, in
progress or working, or it has an MR; as done when State says done or merged, or the MR cell says `MERGED`. MR links
use the first repo under Repos.

## Bindings for this run
- Task source: <epic / ticket list>
- Repos: <repo → main checkout path>
- Orchestrator: terminal <$HC_TERMINAL_ID>, Herdr space <id>, permission mode <mode>

## Rules the user added
- <rule> (<date>)

## Workers
| Name | Address | Task | Context % | Since |
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
2. Window action: go to Herdr tab `<worker>`, type `<words>`

## Decisions (append-only)
- <UTC timestamp> <the user's answer, verbatim enough to act on>

## Cleanup
- <path / container / branch> — <why it exists>
