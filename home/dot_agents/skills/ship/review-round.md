# Auto-review round

Run by the one-shot cron `ship` arms in its last step. Inputs: `<IID>` (the MR) and
`<ROUND>` (1 or 2). Each round ends by rescheduling the next one or by stopping, using this
prompt with the values filled in:

```
Auto-review round <ROUND> of 2 on MR !<IID>: follow ~/.agents/skills/ship/review-round.md.
```

## Steps

1. **Round cap.** `<ROUND>` above 2 → stop and report: "MR !<IID>: N threads still open after
   2 automated rounds — over to you."

2. **Count open threads** with Step 2 of `address-mr-review`, verbatim (same filter: skip
   system notes and `@coderabbit*` commands; a thread counts when its last note is not mine, or
   when it is my own root note with exactly one note).

3. **0 threads** means the bots have not posted yet, so the round is not consumed:
   - Run the pre-merge grep from Step 6b of `address-mr-review` first. A failing CodeRabbit
     pre-merge check posts no thread; it hides in a collapsed `<details>` in the walkthrough.
     `❌` in the most recent block → invoke `address-mr-review`, then continue as in step 4.
   - MR created more than 60 minutes ago → stop: "No review comments on !<IID> after an hour;
     watcher off."
   - Otherwise reschedule this prompt unchanged, same `<ROUND>`, 3 minutes out.

4. **1+ threads** → invoke `address-mr-review` for MR !<IID>. It verifies, fixes what is valid,
   pushes, and replies on every thread. Print its summary table, then reschedule with
   `<ROUND>` + 1, 8 minutes out (the push triggers a re-review that needs time to land).
