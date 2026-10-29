---
name: to-cloud
description: "Hand the current work off to a Claude Code cloud session that picks it up immediately."
argument-hint: "What will the cloud session work on?"
disable-model-invocation: true
---

# To cloud

Write a **handoff** of this conversation and start a Claude Code cloud session seeded with it.
The cloud VM sees only what is pushed and what the prompt carries; local files, uncommitted
changes and `$TMPDIR` stay on this machine.

## Bindings

Read `~/.agents/profile.md`: `kind: work` → each role is bound by the work profile's `cloud.*`
key (`~/.agents/work-profile/work-profile.md`); otherwise use the default.

| Role | Key | Default |
|---|---|---|
| launch repo | `cloud.launch_repo` | the repo the work is in |
| environment | `cloud.environment` | whichever `/remote-env` picked |
| checkout | `cloud.checkout` | the session starts on the pushed branch of the launch repo |

## Step 1 — Branch

In the repo the work is in (skip this step when the work is in no git repo):

```bash
git status --porcelain
git rev-parse --abbrev-ref '@{u}'   # fails → no upstream
git log --oneline '@{u}..HEAD'
```

- **Uncommitted or untracked changes** → stop: list them and ask the user to commit or stash,
  then rerun.
- **No upstream, or commits ahead of it** → show the commits and offer to run
  `git push -u origin HEAD`. On no, stop.

Done when the working tree is clean and `HEAD` equals its upstream.

## Step 2 — Handoff

Write a handoff that lets a fresh agent continue the work, to `$TMPDIR/to-cloud-<slug>.md`. If
the user passed arguments, they describe what the cloud session will work on: tailor the
handoff to that.

- **Open with where the work is**: the repo, the branch and the ticket key (from the branch
  name), in the form the checkout binding needs; then what is done and what is next.
  Read every ticket key you name (parent, epic, related) from the tracker, not from
  memory.
- **Suggested skills**: which skills the next agent should call the Skill tool for.
- **Reference** committed artifacts (specs, commits, MRs, tickets) by path or URL instead of
  restating them. A local path that is not pushed (a plan in `$TMPDIR`, a log, a screenshot) is a
  dead link in the VM: inline the part the next agent needs, or drop it.
- **Redact** secrets, tokens and PII: the handoff becomes the session's prompt.

Done when the handoff holds no dead links.

## Step 3 — Launch

`--environment` takes only self-hosted `ccpool_` IDs, so the CLI reaches an Anthropic-hosted
environment through the `/remote-env` pick alone:

```bash
jq -r '.remote.defaultEnvironmentId // empty' ~/.claude/settings.json
```

Empty, or different from the `env_` ID the environment binding names → stop and ask the user to
run `/remote-env` and pick the bound environment.

The VM clones the launch repo's GitHub remote at its current branch, so that branch must be
pushed too. `--cloud` refuses to run without a terminal, so `script` gives it one; with stdin
closed it creates the session and exits. `$(cat …)` keeps the shell from expanding backticks or
`$` in the handoff:

```bash
(cd <launch repo> && script -q /dev/null claude --cloud "$(cat <handoff file>)" </dev/null) \
  | grep -aoE 'https://claude\.ai/code/session_[A-Za-z0-9]+' | head -1
```

Report the session URL it prints.
