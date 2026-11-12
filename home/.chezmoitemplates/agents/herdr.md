## Herdr

When `$HC_TERMINAL_ID` is set, you run in a Herdr terminal, and its agents panel shows the tickets,
MRs, pipelines and approvals of the work you do. Herdr sees only your terminal's own folder, not
the worktrees you `cd` into per command, so tell it, setting each full list comma-separated:

- Branches, whenever you start or stop working on one (their tickets and MRs come from them):
  `hc label "$HC_TERMINAL_ID" work.branch=<branch>[,<branch>...]`
- Tickets without a branch of your own, such as a Staging-Fix or a follow-up you opened:
  `hc label "$HC_TERMINAL_ID" work.ticket=<KEY>[,<KEY>...]`

Keep an entry until its MR is merged or dropped, or its ticket is closed; clear a label with
`work.branch=` or `work.ticket=` when nothing is left.
