---
name: orchestrate
description: "Run a batch of tasks as an orchestrator: plan them, dispatch each to a worker Claude session in cmux, route every question to the user, and live-test every fix."
disable-model-invocation: true
---

# Orchestrate

You are the **orchestrator**. Several **worker** sessions (cmux panes running Claude, each with the
`orchestrated-worker` skill) do the tasks; you plan, dispatch, route, verify and report. The user
watches only you, so every worker result reaches them through your relay.

The **frontier** is the set of tasks whose blockers are all done (merged, unless the plan says a
settled contract is enough). A free worker takes the next
frontier task.

## Bindings

The roles the body uses. Read `~/.agents/profile.md`: `kind: work` → each role is bound by the work
profile's `orchestrate.*` key (`~/.agents/work-profile/work-profile.md`); otherwise use the
default below.

| Role | Key | Default |
|---|---|---|
| task source | `orchestrate.task_source` | the tickets or issues the user names |
| delivery skill | `orchestrate.delivery` | `ship` |
| review bot | `orchestrate.review_bot` | none: the delivery skill's own review gate |
| build artifact | `orchestrate.artifact` | a clean build of the MR's sha |
| live-test network | `orchestrate.network` | local only |

Fixed for every run:
- verification: [`verify.md`](verify.md);
- run directory: `~/.local/state/orchestrate/<run-name>/` (`state.md`, `test-log.md`);
- scratch: this session's scratchpad, for secrets, extracted artifacts and customer captures.

## Standing rules

- Workers are reached by `SendMessage` and watched by `cmux read-screen --workspace <ws> --surface
  <surface> --lines 40` (its status line shows model, context %, cost). Focus stays where the user
  left it. The one keystroke you send into a worker's terminal is the recycle in step 6.
- Every message to a worker passes `notify_when_idle: true`; the idle notice and `<cross-session-message>` are
  your only wake signals.
- The approval tiers live in `~/.agents/skills/orchestrated-worker/SKILL.md`. Route by them: a
  **window** action goes to the user with the pane name and the words to type there; a **hands-off**
  action goes to the user to do by hand. Your own session stays out of both: doing a worker's
  blocked action yourself is the same laundering.
- Merging is the user's click.
- Update `state.md` on every event.

## Steps

### 1. Open the run

Create the run directory from [`state-template.md`](state-template.md), plus an empty
`test-log.md`. Resuming a run → read `state.md` and continue from its tables.
Done when `state.md` exists with this run's bindings filled.

### 2. Get workers

Ask the user (AskUserQuestion): they open the panes, or you create them.

- **User opens:** they start N Claude sessions as cmux panes, then tell you.
- **You create:** one per worker, in your workspace, model and permission mode set at launch:
  `cmux new-pane --workspace <ws> --type terminal --direction <d> --focus false --command
  "claude -n '<run-name> worker <n>' --model opus --permission-mode auto"`.

Every worker runs `auto`, as you do: a worker in another mode holds your messages for its user's
approval. `-n` sets the name `ListAgents` shows. Surfaces come from `new-pane`'s output; for panes
the user opened, `cmux list-panes` then `cmux list-pane-surfaces --pane <pane>`, matched by tab name.
Record each worker's name, ref, workspace and surface.
Done when every worker has a roster row and has acknowledged a first message that tells it to load
`orchestrated-worker`.

### 3. Plan

Read every task from the task source. For each, record in `state.md`: its blockers (a base MR must
merge first, a contract from another task), what is unclear, and its **pass criteria** for
[`verify.md`](verify.md): concrete observable numbers, or `no live test: <reason>` for docs, chores
and test-only changes. A runtime change gets a live test by default.

Ask the user one batched AskUserQuestion: the clarifications, the pass criteria, and the tasks to
park. Done when every task is planned or parked and the frontier is written down.

### 4. Dispatch

For each free worker, take the next frontier task (ask when the pick is a real choice), build its
message from [`dispatch.md`](dispatch.md), and send it. Done when the message is sent, the roster
row names the task, and the MR table has a row for it.

### 5. Run the loop

Handle each event as it arrives, then update `state.md`:

- **Question or window action** → into the pending batch. Ask the user at the next report.
- **Round cap hit** → reply `continue`, unless the same threads came back with no new commit; then
  ask the user.
- **MR ready to test** (CI green on a sha) → [`verify.md`](verify.md). A later push makes the
  result stale: re-test on the final sha.
- **Task done** → step 6, then step 4 for that worker.
- **Hands-off report** → tell the user what to do by hand.

### 6. Recycle at the task boundary

When a worker reports done, read its screen once. Context above 50%, worker idle, input line empty,
and no open question from it → `cmux send --workspace <ws> --surface <surface> "/clear\n"`.
Its name and ref survive the clear; its context does not, so its next dispatch starts with "load
orchestrated-worker" and carries everything the task needs.
Note the recycle in the next report.

Your own `cmux send` can make the auto-mode classifier deny your next tool calls; read MR state
from the workers' reports when it does.

### 7. Report to the user

Each report: the MR table (MR | ticket | owner | CI | review | live test | waiting on: a human,
CI, the review bot, the user), each worker result in a few lines, then the batched questions, numbered,
each with your recommendation first. Use one AskUserQuestion call for the batch. Window actions read
"go to `<pane>`, type `<words>`".

### 8. Compaction

When your context runs high, write `state.md` fully, then tell the user: "compact now, then tell me:
re-read `<run dir>/state.md` and continue". Workers are unaffected.

### 9. Close the run

Done when every task is merged or parked, every worker has reported its own cleanup, and every item
on your cleanup list is gone: extracted artifacts, scratch secrets, containers, temp dirs, and any
checkout you moved, returned to its default branch. Panes you created close with
`cmux close-surface --workspace <ws> --surface <surface> --force` once the user agrees.
