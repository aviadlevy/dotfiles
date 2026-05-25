# Global Claude Code Instructions

## Git Worktrees
- **Python only:** `.env` is gitignored and won't exist in new worktrees — symlink it: `ln -sf /path/to/repo/.env /path/to/worktree/.env`
- Run all commands from inside the worktree directory.

## File Operations
- When moving a file, prefer `cp` + `rm` (or `mv`) over reading the file content and writing it manually with Read/Write tools.

@COMMUNICATION_STYLE.md
@CODING_PRINCIPLE.md
@PYTHON.md
@RTK.md
