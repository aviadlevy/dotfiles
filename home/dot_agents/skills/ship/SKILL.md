---
name: ship
description: "Use when ready to ship: takes local changes to an open MR, with the Jira ticket in Code Review and the pipeline and review watchers armed."
---

# /ship — Full Delivery Flow

Work through Steps 1–9 in order; a step whose work is already done is skipped and reported
as such in the final summary.

**Infer by default.** Ask the user at exactly three points: the ticket question in Step 1,
review findings in Step 4, and any release field whose rule says *ask* in Step 7. Derive
everything else (ticket text, branch name, commit message, MR body, release note) from the
diff and the ticket.

**On a failed command**, print the error and ask: abort or continue?

**Company values** come from the work profile, `~/.agents/work-profile/work-profile.md`. Read
it before Step 1; values below appear as its dotted keys (`jira.server`, `mr.target_branch`,
…). When the file is missing, stop: "No work profile at `~/.agents/work-profile/` — copy
`~/.agents/work-profile.example/` there and fill it in."

---

## Step 1 — Ticket

```bash
git branch --show-current
```

- **A `git-conventions` branch** (`<type>/<TICKET_ID>-…`) → read `TICKET_ID` off the name.
  Ensure ownership (below), then go to Step 3.
- **`main` / `development` / `master`** → ask:
  > "Do you have a Jira ticket ID, or should I create one? (Enter a `<jira.project>` ticket ID, or press Enter to create a new ticket)"
  - An ID → ensure ownership, then Step 2.
  - Enter → create the ticket with the `jira-ticket` skill (it asks Task vs Sub-task and
    handles epic, assignee, sprint, and `jira.status.in_progress`). Write its summary and description
    from the branch diff: `git diff $(git symbolic-ref refs/remotes/origin/HEAD | sed 's|refs/remotes/origin/||')...HEAD`.
    Then Step 2.
- **Any other branch** → "Current branch `<name>` does not follow expected naming convention.
  Proceed from Step 3 anyway? (y/N)"

### Ownership

Every existing ticket ends this step **assigned to `jira me`** and **on the active sprint**
(idempotent):

```bash
jira me                                                               # note the email
jira issue view <TICKET_ID> --plain --no-headers --columns ASSIGNEE,TYPE
jira issue assign <TICKET_ID> <email>                                 # when not already me
jira sprint list --state active --table --plain --no-headers --columns ID,NAME,STATE
```

- **Task / Story / Bug** → `jira sprint add <SPRINT_ID> <TICKET_ID>`.
- **Sub-task** → the sprint lives on the parent; `jira sprint add` on a sub-task fails. Find
  the parent and add *it* when it is missing from the sprint:
  ```bash
  jira issue view <TICKET_ID> --raw | python3 -c "import sys,json; print(json.load(sys.stdin)['fields']['parent']['key'])"
  jira issue list --plain --no-headers --columns KEY --jql 'key = <PARENT_KEY> AND sprint in openSprints()'
  # empty output → jira sprint add <SPRINT_ID> <PARENT_KEY>
  ```
- **A ticket type listed under `process.*`** in the profile → read that process file before
  Step 2. It can change the base branch, the MR target, and the Jira states, and it wins over
  the steps below wherever they differ.

---

## Step 2 — Branch

Name the branch per `git-conventions`, taking the type and description from the ticket
summary and the diff:

```bash
git checkout -b <type>/TICKET_ID-<short-desc>
```

---

## Step 3 — Commit

When `git status --short` lists changes:

1. Write the message per `git-conventions`, summarising `git diff`.
2. Stage each path from `git status --short` by name: `git add <file1> <file2> ...`.
   Explicit paths keep stray local files out of the commit.
3. `git commit -m "<message>"`

---

## Step 4 — Review Gate

Did `mattpocock-skills:code-review` and `ponytail:ponytail-review` both run on these changes
in this session, with no edits since? Then skip. Otherwise ask:

> "No local review in this session. Run `/mattpocock-skills:code-review` + `/ponytail:ponytail-review` now? (Enter = yes, s = skip)"

On yes, invoke both in **one message** so they run in parallel. Present any findings and ask
**fix now, or ship anyway?** — the push waits for the answer. Fixes go in with
`git commit --amend --no-edit` (nothing is pushed yet).

---

## Step 5 — Push

`git status -sb` shows `[ahead N]` or no upstream → `git push -u origin <current-branch>`.

---

## Step 6 — Merge Request

`glab mr list --source-branch <current-branch>` finds one → print its URL, go to Step 7.

Otherwise write the body with the `mattpocock-skills:pr` skill against the branch diff, and
append the Jira section. **Evidence** draws only on test or command output already in this
session; with none, the body leaves the Evidence section out entirely. The quoted heredoc keeps
the body's code fences and `$` literal:

```bash
MR_DESC=$(cat <<'EOF'
<body from the pr skill>

## Jira
[<TICKET_ID>](<jira.server>/browse/<TICKET_ID>)
EOF
)

glab mr create \
  --source-branch <current-branch> \
  --target-branch <mr.target_branch> \
  --title "<commit-style title per git-conventions>" \
  --description "$MR_DESC" \
  --assignee <mr.assignee> \
  --yes
```

Print the MR URL.

**The merge belongs to a human.** `ship` stops at an open MR: no `glab mr merge`, no
`--auto-merge` / `--merge-when-pipeline-succeeds`, from this skill or any it invokes. Arming
auto-merge *is* merging; it lands the MR unattended. Two MRs merged that way on 2026-09-15
because "do not merge" was read as "do not merge *now*". Queueing is the author's call.

---

## Step 7 — Release Fields

Set every field in `release.fields`, each by its row's rule, in one edit, then read them back:

```bash
jira issue edit <TICKET_ID> \
  --custom "<field>=<value>" \
  --custom "<field>=<value>" \
  --no-input
jira issue view <TICKET_ID> --plain 2>/dev/null | grep -iE "<field-name>|<field-name>"
```

Done when the read-back shows every field. `✓ Issue updated` proves nothing: `--custom`
resolves names against the local cache (`~/.config/.jira/.config.yml`), and a stale name
prints success while setting nothing. For a value missing from the read-back, set it over REST
with [`jira-rest.md`](jira-rest.md).

---

## Step 8 — Code Review

Skip when there is no `TICKET_ID`, or `jira issue view <TICKET_ID> --plain --no-headers --columns STATUS`
already reads `jira.status.code_review` or `jira.status.done`. Otherwise:

```bash
jira issue move <TICKET_ID> "<jira.status.code_review>"
```

---

## Step 9 — Watchers

Arm both, then finish; neither blocks.

1. **Pipeline** — invoke `gitlab-pipeline-monitor` (its own 5-minute cron; analyses failures,
   notifies on success). Note the cron ID.
2. **Review rounds** — one-shot `CronCreate` (`recurring: false`), 3 minutes out:
   ```
   Auto-review round 1 of 2 on MR !<IID>: follow ~/.agents/skills/ship/review-round.md.
   ```

Tell the user both job IDs, and that the crons are **session-only**: they die with this
session.

---

## Final Output

```
✓ Jira:    created <TICKET_ID> / used <TICKET_ID>
           sub-task of <PARENT_KEY> (in <SPRINT>)   (or: standalone, added to <SPRINT>)
✓ Branch:  created <branch>                         (or: already on <branch>)
✓ Commit:  <commit message>                         (or: nothing to commit)
✓ Review:  code-review + ponytail-review, 0 findings (or: already reviewed · skipped by user)
✓ Push:    pushed to origin                         (or: already up to date)
✓ MR:      <MR URL>                                 (or: already existed)
✓ Release: <field>=<value> · … (all read back)
✓ Jira:    <TICKET_ID> → <jira.status.code_review>  (or: already there)
✓ Watch:   pipeline cron <id> · review rounds 1-2 armed (session-only)
```
