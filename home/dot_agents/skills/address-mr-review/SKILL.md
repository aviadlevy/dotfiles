---
name: address-mr-review
description: Use when addressing, replying to, or resolving review comments on a GitLab MR — CodeRabbit, Baz, other review bots, or human reviewers. Also for a failing CodeRabbit pre-merge check, or a review that never arrived because it was rate limited. E.g. "address the coderabbit comments", "fix the review nits". GitLab-specific (glab).
---

# Address Review Comments on a GitLab MR

Fetch the review threads on a merge request, judge each one, fix what's valid, push back on what isn't, and **reply on every thread**. Works for any reviewer — CodeRabbit, Baz, other bots, or humans. GitLab-specific — uses `glab`.

## Operating principles (these are non-negotiable — the user asks for them every time)

1. **Be judgemental.** Findings are NOT mandatory, whoever wrote them. Default to skepticism. Nits, style preferences, and out-of-scope suggestions can be declined.
2. **Verify before implementing.** Read the *current* code each finding references. It may already be fixed, obsolete, or simply wrong. Never fix on the comment's say-so alone.
3. **Fix only what's valid and worth fixing.**
4. **Push back on the rest** — with a concrete reason.
5. **Same skepticism, tone by reviewer.** Judge bot and human findings by the same bar. A **bot** reply is blunt (`Not changing this — <reason>`). A **human** reply is collegial: assume there was a good reason, explain your reasoning, and where it's a genuine judgement call, ask rather than flatly decline. A **MINE** thread — a root comment the MR author left on their own MR — is a note-to-self: action it like any finding, reply plainly with what you did, and never skip it.
6. **Reply on every *finding* thread** — fixed, pushed back, or already-handled. No finding left silent.
   **Never reply inside a bot bookkeeping thread** (walkthrough, `Actionable comments posted: N`,
   review-status, scan-result notes). Those are resolvable but nobody ever resolves them, so a reply
   there becomes a permanent unresolved marker on the MR. Mine them for content, then stay out.
7. **Fully autonomous:** verify → fix valid → commit → push → reply, in one run. Report a summary at the end.
8. **Resolve exactly the threads you opened — those, and only those.** A reviewer's thread is
   theirs to close: reply and leave it. A comment you post —
   including a `@coderabbitai …` command — becomes a *resolvable* discussion. Leave it open and the
   MR sits at `discussions_not_resolved` and cannot merge, even when every finding is handled. If
   you comment, it is yours to close. **CodeRabbit replying into your command thread does not hand
   it over** — its answer makes the thread look like the bot's, which is precisely how these get
   left open. Resolve it once answered, whatever the answer says (Step 6b).
9. **Do NOT re-request a re-review.** Review bots re-review automatically on new commits.
   **The one exception is a rate limit** — there the automatic pass did not happen at all, so the
   MR is unreviewed rather than reviewed-and-quiet. Wait out the interval and resume (Step 6b).
   Batch your pushes: every push spends allowance, and a run of small pushes burns what one
   batched push would have used once.

## Step 1 — Identify the MR

If the user gave an MR number or URL, use it. Otherwise find it from the current branch:

```bash
BRANCH=$(git branch --show-current)
glab mr list --source-branch "$BRANCH"
```

Store the MR **iid** (the `!NN` number). If no MR exists, tell the user and stop.

## Step 2 — Fetch the review threads

Fetch the threaded discussions and your own username (to skip your own threads):

```bash
ME=$(glab api user | python3 -c "import sys,json;print(json.load(sys.stdin)['username'])")  # no --jq flag in this glab build
glab api "projects/:id/merge_requests/<IID>/discussions?per_page=100" 2>/dev/null > /tmp/mr_disc.json
```

`projects/:id` resolves from the repo's GitLab remote — run from inside the repo. (Or set `PROJ="org%2Fpath%2Frepo"` URL-encoded and use `projects/$PROJ/...`.)

Parse out every review thread that still **needs addressing** — with its discussion id, author, reviewer type, file, line, and body.

A thread needs addressing when it is not a system note, not a bot bookkeeping note, its root body
is not a bot command (`@coderabbit review` and friends are instructions, not findings), and **either**:
- the **last** note is not yours — a bot or colleague spoke last, **or**
- the **root** note is yours and the thread has **exactly one** note — you raised it and nobody has answered.

`glab` authenticates as you, so "authored by me" cannot distinguish your own review findings
from this skill's replies. The one-note rule is what separates them: once a reply lands, the
thread has two notes and drops out on the next pass.

```bash
ME_USER="$ME" python3 - <<'PY'
import json, os, re
me = os.environ["ME_USER"].lower()
BOT_PATTERNS = ("coderabbit", "baz", "bot_")  # known review bots + gitlab bot-account prefix
CMD = re.compile(r"^\s*@(coderabbit|baz)", re.I)  # bot commands, not findings
# Bot bookkeeping: walkthrough, review-status, scan results. Read them, never reply in them.
NOISE = ("summarize by coderabbit.ai", "comment by coderabbit for review status",
         "actionable comments posted:", "review_stack_entry_start")
# Company bots: each `review.noise_markers` entry from ~/.agents/work-profile/work-profile.md,
# when that file exists. No profile → leave EXTRA empty.
EXTRA = ()
NOISE += EXTRA
# Optional: if the user named ONE reviewer (e.g. "coderabbit" / "baz"), set ONLY = "coderabbit"
ONLY = None
d = json.load(open("/tmp/mr_disc.json"))
for disc in d:
    notes = [n for n in disc.get("notes", []) if not n.get("system")]
    if not notes: continue
    n0, last = notes[0], notes[-1]
    author = (n0.get("author") or {})
    uname = author.get("username", "").lower()
    who = f"{author.get('name','')} {uname}".lower()
    mine = uname == me
    body0 = n0.get("body", "")
    if CMD.match(body0):                       # "@coderabbit review" — a command, not a finding
        continue
    if any(m in body0.lower() for m in NOISE): # bookkeeping — surfaced separately, never replied to
        continue
    # Needs addressing when someone else spoke last, OR it is my own root note nobody answered.
    answered = (last.get("author") or {}).get("username", "").lower() == me
    if answered and not (mine and len(notes) == 1):
        continue
    is_bot = author.get("bot") or any(p in who for p in BOT_PATTERNS)
    kind = "MINE" if mine else ("BOT" if is_bot else "HUMAN")
    if ONLY and ONLY not in who:
        continue
    pos = n0.get("position") or {}
    loc = f"{pos.get('new_path','?')}:{pos.get('new_line','')}" if pos else "(no position)"
    body = re.sub(r"<details>.*?</details>", "", n0.get("body",""), flags=re.S)
    print("="*70)
    print(f"disc_id={disc['id']}  {kind}  by={author.get('username','?')}  resolved={n0.get('resolved')}  {loc}")
    print(body.strip()[:1200])
PY
```

**Comment types to expect:**
- **Inline diff comments** — threads with a `position` (file + line). Most actionable.
- **Top-of-MR bookkeeping** — the walkthrough and `Actionable comments posted: N` notes, plus **pre-merge checks**. Filtered out above as reply targets, but **read them manually** (`grep -i 'actionable\|pre-merge' /tmp/mr_disc.json`, or just open the MR): they often name items with no inline thread. Fix those, and account for them in the single standalone note of Step 6 — never by replying in the bookkeeping thread. **Pre-merge checks are not threads at all — see Step 6b, and do not call an MR clean without running that check.**
- **Replies within a thread** — usually informational context; only actionable if they raise something new.
- **Your own root comments** — findings you left on your own MR while reviewing. Treated like any reviewer. `@coderabbit …` commands are excluded.

If the user named a specific reviewer ("address the coderabbit comments", "address baz"), set `ONLY` to that substring to filter. Default: address all reviewers.

## Step 3 — Verify and classify each finding

For each thread, open the referenced file at the current code and decide:

| Verdict | When | Action |
|---------|------|--------|
| **FIX** | Real issue, valid, worth fixing | Implement the fix |
| **PUSHBACK** | Wrong, not worth it, out of scope, style-only nit you disagree with | Don't change code; reply with the reason |
| **OBSOLETE** | Already fixed / no longer applies in current code | Don't change code; reply noting it's handled |

Be judgemental — same bar for bots and humans. A finding being "technically true" is not enough; it must be worth the change. When unsure on a borderline call, lean toward FIX for correctness/security and PUSHBACK for style/preference nits. For a **human** borderline you'd otherwise decline, prefer asking in the reply over a flat pushback.

## Step 4 — Fix the valid findings

Implement minimal, correct fixes that match repo conventions. Group related fixes. If the repo uses TDD/tests, cover the fix.

## Step 5 — Commit and push

```bash
git add -A
git commit -m "<concise message describing the review fixes>"
git push
SHA=$(git rev-parse --short HEAD)
```

## Step 6 — Reply on every thread

Write each reply body to a temp file (handles markdown/multiline safely), then post.

**Inline diff thread** (reply into the discussion):

```bash
cat > /tmp/mr_reply.md <<'EOF'
Fixed in <SHA>. <what changed and why>.
EOF
glab api --method POST "projects/:id/merge_requests/<IID>/discussions/<DISC_ID>/notes" \
  --field "body=$(cat /tmp/mr_reply.md)"
```

**MR-level content** (findings with no inline thread, a failed pre-merge check, a roll-up worth
stating) → **one** standalone MR note. Posted this way it is an `individual_note` — GitLab does not
make it resolvable, so it cannot leave the MR with an unresolved thread:

```bash
glab api --method POST "projects/:id/merge_requests/<IID>/notes" \
  --field "body=$(cat /tmp/mr_reply.md)"
```

Skip it entirely when every finding already has an inline reply — a roll-up that repeats the inline
threads is noise. Never post it as a reply into `discussions/<DISC_ID>/notes` of a bot status thread.

Reply content by verdict — phrased for the reviewer type (principle 5):
- **FIX** → `Fixed in <SHA>. <explanation>`
- **PUSHBACK** → bot: `Not changing this — <concrete reason>.` / human: `I left this as-is because <reason> — happy to change it if you'd prefer.`
- **OBSOLETE** → `Already handled in current code — <where/how>.`

Reply only — a reviewer's thread is theirs to close. The one exception is a thread you opened
yourself (principle 8).

## Step 6b — CodeRabbit: checks, rate limits, your own threads

Skip this step when the reviewer is not CodeRabbit.

Two CodeRabbit failures **degrade open**: the guard stops working and every GitLab signal still
reads green, so `mergeable` and zero unresolved threads mean nothing on their own. A third trap is
self-inflicted. Before reporting any MR as clean, all three:

1. **Failing pre-merge check** — renders inside a collapsed `<details>` in the walkthrough, never as
   a thread. Grep the most recent `Pre-merge checks` block for `❌ Error`.
2. **Rate-limited review** — the review never ran and nothing says so. Grep for a rate-limit note,
   then compare the last reviewed SHA against HEAD. Wait the stated interval plus ~5 minutes before
   `@coderabbitai resume`.
3. **Your own command threads** — every `@coderabbitai …` you post is a resolvable discussion, and
   CodeRabbit answering in it does not close it. Resolve each one (principle 8), or the MR sits at
   `discussions_not_resolved` with every finding handled.

A failing check is a finding: verify it against the code (Step 3), fix it if valid, push back if not.

**The greps, the exact message formats, the command table and the allowance maths are in
[CODERABBIT.md](CODERABBIT.md).** Read it before running any of the three — the messages are easy to
paraphrase wrongly, and the strings there were taken from real notes.

## Step 7 — Summary

Report a table the user can scan, surfacing pushbacks prominently:

```
MR !NN — review addressed (pushed <SHA>)

FIXED (n)
  • file:line — what was fixed  [reviewer]
PUSHBACK (n)        ← review these
  • file:line — why declined  [reviewer]
OBSOLETE (n)
  • file:line — why already handled  [reviewer]

Replied on all N finding threads. Left unresolved for the reviewer / you to close.
```

## Common mistakes

- **Missing the summary note.** The top-of-MR `Actionable comments posted: N` note often lists items with no inline thread; address those too — but reply in a standalone MR note, not in that thread.
- **Calling an MR clean without grepping for `❌`.** A failing pre-merge check leaves every GitLab
  signal saying "mergeable". It has slipped through repeatedly. Run the Step 6b grep every time,
  even when someone already reported the MR as clean.
- **Leaving your own comment unresolved.** `@coderabbitai …` commands and any note you open create
  resolvable threads. Yours to close (principle 8) — otherwise the MR cannot merge. CodeRabbit
  answering in the thread does not close it and does not make it the bot's.
- **Reading a rate-limited MR as a clean one.** Run the rate-limit grep and compare the last reviewed
  SHA against HEAD before reporting any MR as reviewed. Then wait the stated interval plus a buffer —
  retrying early just yields another refusal and another thread to resolve.
- **Guessing CodeRabbit's wording instead of grepping for it.** The strings in CODERABBIT.md were taken
  from real notes on this group's MRs. If a message does not match, search for the real one
  (`glab api "groups/<group>/search?scope=notes&search=..."`) rather than inventing a variant.
