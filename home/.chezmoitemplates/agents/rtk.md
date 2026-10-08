## RTK

A Claude Code hook routes shell commands through `rtk` (Rust Token Killer), which filters their
output to save tokens (`git status` runs as `rtk git status`).

- `rtk proxy <cmd>` runs a command with raw, unfiltered output: use it when the filtered output
  hides what you need.
- `rtk gain` shows the savings.
