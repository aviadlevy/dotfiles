---
name: skill-cleaner
description: Use when trimming Claude Code skill prompt budget, finding duplicate skills across personal and plugin roots, auditing enabled/disabled plugins, or deciding which skills to remove or shorten.
---

# Skill Cleaner

Audit Claude Code skills loaded into the system prompt: rendered token cost, duplicate skills across personal and plugin roots, unused skills (no recent invocation in logs), and long descriptions that waste prompt budget.

## Workflow

1. Run the analyzer:

```bash
node --experimental-strip-types ~/.claude/skills/skill-cleaner/scripts/skill-cleaner.ts --months 3
```

Useful variants:

```bash
# Skip log scanning (much faster, drops "Unused candidates" section)
node --experimental-strip-types ~/.claude/skills/skill-cleaner/scripts/skill-cleaner.ts --no-logs

# Wider log window + larger cap
node --experimental-strip-types ~/.claude/skills/skill-cleaner/scripts/skill-cleaner.ts --months 6 --max-log-mb 800

# Treat skill metadata as filling a specific share of context
node --experimental-strip-types ~/.claude/skills/skill-cleaner/scripts/skill-cleaner.ts --context-tokens 200000 --budget-percent 2

# Add an extra skill root (e.g. a project's .claude/skills)
node --experimental-strip-types ~/.claude/skills/skill-cleaner/scripts/skill-cleaner.ts --root ~/code/myproj/.claude/skills

# JSON output for piping into jq
node --experimental-strip-types ~/.claude/skills/skill-cleaner/scripts/skill-cleaner.ts --json
```

2. Read the report in this order:
- `Skill Budget`: total rendered tokens of the skill listing, share of `--context-tokens`, and remaining budget under `--budget-percent`.
- `Description Candidates`: long descriptions that can be compressed without losing trigger nouns.
- `Duplicates`: same skill name or near-identical body across personal `~/.claude/skills` and plugin caches.
- `Unused Candidates`: no recent `Skill` tool invocation, slash-command reference, or `SKILL.md` read in recent logs.
- `Root Summary`: where skills came from and whether their plugin is disabled in `settings.json`.

3. Before deleting or editing:
- Verify the kept copy exists and is loaded (description appears in the system-reminder skill list).
- Prefer deleting personal `~/.claude/skills/<name>` copies when an enabled plugin already ships the same skill.
- Keep personal skills that encode your local workflow, secrets paths, or project-specific policy.
- Preserve trigger nouns when shortening a description: product, tool, action, object.

## Analyzer Notes

- **Roots scanned by default**: `~/.claude/skills`, every `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills`, and `~/.claude/projects/**/.claude/skills` (project-scoped). Add more with `--root <path>`.
- **Rendered line shape**: `- name: description` for personal skills, `- plugin:name: description` for plugin skills — matches what Claude Code injects into the system-reminder skill list.
- **Frontmatter parsing**: YAML only; falls back to the parent directory name if `name:` is missing; sanitizes `name` and `description` to a single line.
- **Plugin enablement**: reads `~/.claude/settings.json` then `~/.claude/settings.local.json` (later overrides earlier). A skill is marked disabled when its plugin's `enabledPlugins["<plugin>@<marketplace>"]` is `false`.
- **Token cost**: `ceil(utf8_bytes / 4)` per rendered line, the same rough rule Codex and Claude use; pass `--chars-per-token` to tune.
- **Context window**: defaults to `200000` (Opus 4.7 / Sonnet 4.6). Override with `--context-tokens`. No model-cache lookup — Claude Code doesn't expose one.
- **Budget percent**: defaults to `2%` of context as a heuristic (Claude Code's actual algorithm isn't public). Set `--budget-percent 0` to skip the share calculation.
- **Realpath dedup**: symlinked roots (e.g. a personal skill that's a symlink into a plugin cache) collapse to one entry.
- **Duplicate detection**: same baseName grouped; body hash plus Jaccard word similarity. Suggestions only when the body is near-identical (body ≥ 0.95, or body ≥ 0.85 and description ≥ 0.85). Keep priority: personal `~/.claude/skills` > plugin > project-local.
- **Usage scan**: `~/.claude/history.jsonl` and recent `~/.claude/projects/**/*.jsonl`. Heuristics: `Skill` tool calls (`"skill":"<name>"`), slash-command tokens (`/name`), and explicit `skills/<name>/SKILL.md` references.

## Output Policy

- Suggest first; edit only when the user asks.
- If asked to apply cleanup, make small grouped commits: descriptions, deletes, plugin disables in `settings.json`.
- Never delete a plugin-cache skill directly — disable the plugin in `settings.json` instead, since `claude plugins update` will recreate it.
- Don't delete a personal skill without naming where it came from or confirming it's disposable.
