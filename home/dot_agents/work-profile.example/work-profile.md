# Work profile — <company>

Template. Copy this directory to `~/.agents/work-profile/` and fill every `<placeholder>`.
Skills refer to each value by its dotted **key** (`ship` stops when the profile is missing;
`address-mr-review` runs with its built-in markers only).

## Jira

| Key | Value |
|---|---|
| `jira.server` | `<https://your-site.atlassian.net>` — base URL; ticket links are `<jira.server>/browse/<TICKET_ID>` |
| `jira.project` | `<PROJECT_KEY>` — the key in ticket IDs and JQL |
| `jira.status.in_progress` | `<status name>` — set when work starts |
| `jira.status.code_review` | `<status name>` — set once the MR is open |
| `jira.status.done` | `<status name>` — terminal; nothing moves a ticket out of it |

## Merge requests

| Key | Value |
|---|---|
| `mr.target_branch` | `<branch>` — default MR target |
| `mr.assignee` | `<username>` — your GitLab username |

## Release fields

`release.fields` — jira-cli custom-field names set after the MR opens, one row each:

| Field | How to fill it |
|---|---|
| `<field-name>` | `<rule: inferred from the diff, a default, or "ask the user">` |

`release.type_options`: `<exact option strings, if a field is a dropdown>`

`release.note_example`: `<one real release note, as a style sample>`

## Review bots

`review.noise_markers` — extra bookkeeping-comment prefixes to skip (lowercase substrings):
- `<marker>` — `<which bot posts it>`

## Processes

`process.<ticket-type>` — ticket types that change the delivery flow; read the file before
branching:

| Ticket type | File |
|---|---|
| `<ticket type>` | `<process-file.md, next to this profile>` |
