## Python (.venv)
- Check for `.venv` in the project root before running Python commands.
- Use `.venv/bin/python`, `.venv/bin/pytest`, `.venv/bin/dotenv` directly — no activation needed.
- In git worktrees: `.venv` lives in the **main repo root**. Use absolute paths.

## Environment Variables (.env) — Python projects only
- Load env vars via: `.venv/bin/dotenv run -- .venv/bin/pytest ...`