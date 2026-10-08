# CodeRabbit — checks, rate limits, and your own threads

Reference for `address-mr-review` Step 6b. Read it when the reviewer is CodeRabbit; nothing here
applies to Baz or to human reviewers.

Both failures documented here **degrade open** — the guard stops working and every GitLab signal
still reads green — which is why each needs an explicit grep rather than a glance at the MR.

## Pre-merge checks

**A failing pre-merge check degrades open.** The checks render inside a collapsed `<details>`
block in CodeRabbit's walkthrough comment — they are *not* review threads. So the check fails while
`blocking_discussions_resolved` reads `true`, `detailed_merge_status` reads `mergeable`, the MR shows
zero unresolved threads, and GitLab merges it.

**Degrades open** is the shape both failures on this page share: the guard stops working and every
signal still reads green, so absence of a complaint is not evidence of a pass.

**Never call an MR clean without this grep** — including when the author, an agent, or a previous
run already said it was clean:

```bash
glab api "projects/:id/merge_requests/<IID>/notes?per_page=100" | python3 -c '
import json,sys
for n in json.load(sys.stdin):
    b = n.get("body") or ""
    if "Pre-merge checks" not in b or n.get("system"): continue
    print(n.get("updated_at"), "FAILED" if "❌ Error" in b else "clean")
    for line in b.split("\n"):
        if "| ❌" in line or "Failed checks" in line: print("   ", line.strip()[:200])
'
```

Only the **most recent** block counts — an older ❌ is stale rendering once a later run passes.

Treat a failing check like any other finding (Step 3): verify it against the code, fix it if valid,
push back if not. A check naming a real defect is worth taking even when it is not blocking.

**The two commands, and who may use them:**

| Command | Use |
|---|---|
| `@coderabbitai run pre-merge checks` | Re-run the checks after you push fixes. Safe to use on your own judgement. |
| `@coderabbitai ignore pre-merge checks` | Override a failing check and let the MR be approved. **Only with the MR author's explicit say-so.** Never override a correctness or performance check because you disagree with it — push back on the thread with evidence and let the author decide. |

**Post them with `--raw-field`, never `--field`.** `glab api --field "body=@coderabbitai …"` reads a
value that starts with `@` as a file path, and the POST fails:

```bash
glab api --method POST "projects/:id/merge_requests/<IID>/discussions" --raw-field "body=@coderabbitai run pre-merge checks"
```

**An override survives later pushes.** The walkthrough keeps showing ❌ after a new push, but re-posting
`ignore` only gets "Pre-merge checks are already overridden." Once per MR is enough.

**Both commands create a resolvable discussion (SKILL.md principle 8). If you post one, resolve it** once the
checks have re-run, or the MR is left at `discussions_not_resolved`:

```bash
glab api --method PUT "projects/:id/merge_requests/<IID>/discussions/<DISC_ID>?resolved=true"
```

## Rate limits

A rate limit **degrades open**, the same way a failing pre-merge check does: CodeRabbit does not
review your push, and nothing says so — no failing status, no thread, `detailed_merge_status` still
`mergeable`. Check for it every time, before reporting an MR as reviewed.

(Not to be confused with `Reviews paused` — `review paused by coderabbit.ai` in the walkthrough.
That is a different and benign state. This step is about the rate limit.)

**There are two different messages, and only one of them carries the timer.**

### The long form — an automatic review that was limited

Posted as an auto-generated comment *in place of* the review, so it appears even when nothing asked
for one. Marker: `<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->`.

```
> ⚠️ **WARNING**
> ## Review limit reached
>
> **Next included review available in 44 minutes.**
>
> <details>
> <summary>View limit details</summary>
>
> **Limit details:** You've used all 8 included reviews currently available. Your 3 included PR
> review attempts over the past 7 days set your current allowance at 8 reviews per hour.
```

**`Next included review available in N minutes.` is authoritative — use that number.** The allowance
line underneath is worth reading too: it is derived from the last 7 days of attempts, so it moves
(8/hour on one project, 2/hour on another, same week). Never assume a fixed rate.

### The short form — a command that was refused

A reply to an explicit `@coderabbitai …`, carrying **no timer at all**. The whole body is:

```
<details>
<summary>⚠️ Action not completed</summary>

Review rate limited.

</details>
```

When this is all you have, the number comes from the `**Included review availability:**` line inside
the walkthrough's collapsed `ℹ️ Recent review info` block — *"0 reviews are currently available.
Your included PR review attempts over the past 7 days set your current allowance at 2 reviews per
hour."* With an allowance of *M* per hour a review frees up roughly every `60 / M` minutes, measured
from the **last completed review**, not from the refusal.

### Finding either one

```bash
glab api "projects/:id/merge_requests/<IID>/notes?per_page=100" | python3 -c '
import json, re, sys
for n in json.load(sys.stdin):
    b = n.get("body") or ""
    if n.get("system"): continue
    if "rate limited by coderabbit.ai" in b:
        print("---", n.get("updated_at"), "AUTO REVIEW RATE LIMITED")
        w = re.search(r"Next included review available in\s+([^.*]+)", b)
        if w: print("    wait:", w.group(1).strip())
    if "Review rate limited" in b:
        print("---", n.get("created_at"), "COMMAND REFUSED (no timer in body)")
    m = re.search(r"(Included review availability:\*\*|Limit details:\*\*)(.+?)$", b, re.M)
    if m: print("    quota:", m.group(2).strip()[:160])
'
```

Like the pre-merge checks above, the long form lives in a comment CodeRabbit **rewrites in
place** — once a later review succeeds it is replaced, so only the current state counts. An old
rate-limit note on an MR that has since been reviewed is not a problem.

**Always add a ~5 minute buffer** to whichever number you got. The refill is not instantaneous, and
a retry that lands early achieves nothing except another refusal and another thread to resolve.

### Then resume

Once the wait plus buffer has elapsed:

```
@coderabbitai resume
```

Post it as an MR note. Then confirm a review actually arrived — do not assume the command worked;
if it comes back rate limited again, the allowance was lower than you derived, so re-read the
availability line and wait the full interval from *that* reply.

**Never `@coderabbitai full review`.** It re-reads the whole diff from scratch and burns the
allowance the automatic pass needs. Measured: four `full review` calls across two MRs produced
exactly one review; the rest were absorbed by the limit, leaving one MR's HEAD reviewed only against
an earlier push.

### Resolving your own command threads — including once CodeRabbit has answered

A `@coderabbitai …` command is a thread **you** opened. CodeRabbit replying into it does not
transfer ownership and does not resolve it — the reply just makes the thread *look* like the bot's,
which is exactly why these get left open. Principle 8 still applies: **yours to close.**

Resolve it once CodeRabbit has answered, **whatever the answer says**. A `Review rate limited.`
reply is still a closed exchange — that thread has served its purpose, and a later retry is a fresh
command, not a continuation of it.

```bash
glab api "projects/:id/merge_requests/<IID>/discussions?per_page=100" | python3 -c '
import json, sys
for d in json.load(sys.stdin):
    notes = d.get("notes") or []
    if not notes or notes[0].get("system"): continue
    first = notes[0]
    if "@coderabbitai" not in (first.get("body") or ""): continue
    answered = any("coderabbit" in (n.get("author", {}).get("username") or "").lower()
                   for n in notes[1:])
    print(d["id"], "ANSWERED" if answered else "awaiting",
          first["author"]["username"], repr((first.get("body") or "").strip()[:60]))
'
```

Resolve each answered one:

```bash
glab api --method PUT "projects/:id/merge_requests/<IID>/discussions/<DISC_ID>?resolved=true"
```

**Use the full 40-character discussion id.** A truncated id returns 404, and the failure reads like
"that thread doesn't exist" rather than "you pasted half an id".

Do this in the same pass as the `❌` grep above, **before** reporting the MR as clean — an
unresolved command thread holds `detailed_merge_status` at `discussions_not_resolved` and blocks the
merge even when every finding is handled. Two MRs were blocked this way in a single afternoon.

### What to report

If the review is still absent when you finish, say so and **name the SHA the last substantive
review actually covered**:

```
⚠️ CodeRabbit last reviewed <SHA> (<time>). HEAD is <SHA2> — <n> commits unreviewed.
   Rate limited; allowance <M>/hour. Next attempt ~<time>.
```

An MR whose reviewed SHA is behind HEAD has a review-coverage gap on the exact commit that would
merge. That is a finding, not a formality — report it rather than letting silence read as approval.
