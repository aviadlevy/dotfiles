## Python

- When the project root has a `.venv`, use it directly: `.venv/bin/python`, `.venv/bin/pytest`,
  `.venv/bin/dotenv`. No activation needed.
- Load `.env` variables with `.venv/bin/dotenv run -- <command>`, e.g.
  `.venv/bin/dotenv run -- .venv/bin/pytest`.
- **In a git worktree:** `.venv` lives in the main repo root (use absolute paths), and the
  gitignored `.env` is missing; symlink it: `ln -sf /path/to/repo/.env /path/to/worktree/.env`.
