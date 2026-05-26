---
name: yoram
description: Send a work journal entry to Yoram (butler on the home Mac) via HTTP over Tailscale. Use with a message, without (to be prompted), or proactively suggest after major milestones.
version: 3.0.0
author: aviadlevy
triggers:
- "/yoram"
- "tell yoram ..."
- "send to yoram ..."
- "log to yoram ..."
- "proactive: after major implementation phase, plan completion, PR merge, sprint-level decision, or significant discovery"
---

# /yoram — Send Message to Yoram

Send a work journal entry to Yoram (the butler agent on the home Mac) by POSTing to butler's local HTTP receiver over Tailscale. Butler logs the entry to today's memory file and then posts a short "noted from work laptop: …" acknowledgment back on Telegram, so you still see confirmation on your phone.

## Usage

- `/yoram Finished the auth refactor PR` — sends immediately
- `/yoram` — prompts you for what to log, then sends
- **Proactive suggestion** — after a major milestone, suggest a Yoram update without sending

## Proactive Suggestion Mode

After completing a meaningful unit of work, propose a Yoram update **without sending it**. Wait for the user to confirm (e.g. "yes", "send it", "go") before invoking the send step.

**Suggest after (major events):**
- A multi-step implementation plan completes
- A feature/refactor lands or a PR is merged
- A non-trivial bug is root-caused and fixed
- A meaningful design decision or scope change
- A blocker is discovered or a ticket is filed
- An investigation produces a clear conclusion

**Do NOT suggest for (tiny events):**
- Single file edits, typo/lint/format fixes
- Reading or exploring code
- Running a test or command
- Intermediate steps inside a larger task still in progress
- Minor refactors with no behavior change

**Format of the suggestion:**

> Worth telling Yoram? Proposed entry: "<draft message>"

Keep the proposal inline and brief. If the user declines or ignores it, drop it — do not re-suggest the same milestone.

## Steps

### 1. Determine the Message

- If the user provided text after `/yoram`, use that as the message.
- If no text was provided, ask:
  > "What do you want to tell Yoram?"
  Wait for the user's response and use that as the message.

### 2. Refine the Message

Before sending, refine the message to be **concise and journal-ready**. Yoram collects these entries to build a long-term office journal, so the message must be:

- **Up to 2 short sentences. Hard cap.** If it doesn't fit, cut it.
- **Highlight-only**: what shipped, decided, or discovered — never the play-by-play
- **Context-tagged**: ticket IDs, repo names, people, key decisions when they matter
- **Precise and factual**: no filler, no hedging, no pleasantries
- **Present tense**: "Merged auth refactor" not "I just finished merging the auth refactor"

Examples (each ≤2 short sentences):
- "Merged auth refactor. Switched to decorator pattern per Ido's suggestion."
- "Found opengrep false positives on Go interface assertions."
- "Picked up SCA dep resolution and semgrep tuning this sprint."

### 3. Send to Yoram

Run the send script:

```bash
zsh /Users/aviadlevy/.claude/skills/yoram/send.sh "<message>"
```

**Important:** The `<message>` must be passed as a single shell-quoted argument. Escape any single quotes in the message content.

### 4. Report Result

- On success: tell the user the message was sent to Yoram.
- On failure: show the error message from the script and suggest checking:
  - Are `WORK_LAPTOP_TOKEN` and `BUTLER_HOST` set in `~/.env.personal`?
  - Is Tailscale up on the work laptop? (`tailscale status`)
  - Is the home Mac's journal-receiver running and reachable on `${BUTLER_HOST}:${BUTLER_PORT}` (default port 8787)?
  - If butler logged the entry but no Telegram ack arrived, that's a butler-side issue — entry is still saved.
