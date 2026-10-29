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

## Orchestrate

Bindings for the `orchestrate` skill; a missing key falls back to the skill's default.

| Key | Value |
|---|---|
| `orchestrate.task_source` | `<where tasks come from, and which ones are yours>` |
| `orchestrate.delivery` | `<delivery skill; how human reviewers are requested>` |
| `orchestrate.review_bot` | `<bot, its re-review command, any command that is hands-off>` |
| `orchestrate.artifact` | `<how to fetch and check the CI build for a sha>` |
| `orchestrate.network` | `<what a live-test network run must pre-flight>` |

## Cloud

Bindings for the `to-cloud` skill; a missing key falls back to the skill's default.

| Key | Value |
|---|---|
| `cloud.launch_repo` | `<local path of the GitHub repo cloud sessions start in>` |
| `cloud.environment` | `<name, as /remote-env lists it>` (`<env_ id /remote-env prints>`) |
| `cloud.checkout` | `<what the handoff must name so the session can check the work out>` |

## Processes

`process.<ticket-type>` — ticket types that change the delivery flow; read the file before
branching:

| Ticket type | File |
|---|---|
| `<ticket type>` | `<process-file.md, next to this profile>` |
