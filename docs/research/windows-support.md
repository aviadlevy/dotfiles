# Native Windows support: research and plan

Researched 2026-11-27 against the repo at commit `820aa97` plus the uncommitted working tree.
The working tree changed during the research. This file reflects it as of the end: the
`my-work-skills` external moved to `run_after_00-work-skills.sh.tmpl`, and the work-only kubectx
externals that used `uname_arch` were removed.
Every external claim cites a primary source. **Unverified** marks anything not confirmed in one.
"Verified in source" means read in chezmoi's Go source (clone of `twpayne/chezmoi` at
`954328e`, 2026-11-27) or tested locally with chezmoi v2.74.1.

## TL;DR

- **Package manager: winget**, with Scoop only as a fallback. winget ships with Windows 11 and
  current Windows 10. Every CLI in `Brewfile` except `tmux` and `pyenv` has a winget ID, and all of
  them were checked against `microsoft/winget-pkgs`. Portable packages install per user and land
  on PATH by themselves. Chocolatey needs an admin shell, so it is not used.
- **chezmoi runs `.ps1` scripts with `pwsh`, or `powershell` when `pwsh` is missing.** It ignores
  the shebang on Windows. Every existing `run_*.sh` and both `modify_*` scripts (which have no
  extension) **fail on Windows**, because chezmoi executes the temp file directly. Gate them with
  `.chezmoiignore` (`.chezmoiscripts/*.sh` matches, tested) and add `.ps1` twins.
- **Two templates break `chezmoi init`/`apply` on Windows today**: `.chezmoi.toml.tmpl` calls
  `output "uname"`, and `dot_gitconfig.tmpl` calls `output "sh"`. Git for Windows puts only
  `Git\cmd` on PATH by default, so neither command exists. Both have one-line fixes.
- **Rewrite the two `modify_` scripts as chezmoi `modify-template`s.** chezmoi's built-in `jq`
  (gojq) keeps the Claude settings merge in one copy for every OS, with no `sh` or external `jq`.
- **Use a PowerShell 7 profile with starship.** `home/dot_config/starship.toml` already exists and
  starship reads `~/.config/starship.toml` on Windows too. PSReadLine is built in, plus PSFzf,
  zoxide and fnm.
- **Don't port**: zsh, oh-my-zsh, p10k, tmux, Ghostty, cmux, herdr-notify (launchd) or the mac
  casks.
- **WSL2 complements native Windows and does not replace it.** The Linux path should run
  unchanged inside WSL2 Ubuntu 24.04, the same distro the Docker test passes on. This was not run
  in WSL itself (unverified).

---

## 0. What exists today (grounding)

| Piece | File(s) | Windows impact |
|---|---|---|
| Source root | `.chezmoiroot` → `home` | Unchanged |
| Config template | `home/.chezmoi.toml.tmpl`: `uname_arch = {{ output "uname" "-m" ... }}` | **Breaks init** on Windows. In the working tree `uname_arch` is used nowhere else (grepped). HEAD still used it in the kubectx externals, which the working tree removes. |
| Git config | `home/dot_gitconfig.tmpl`: `output "sh" "-c" "git config --global --get coderabbit.machineId ... \|\| true"` | **Breaks apply** on Windows (no `sh` on PATH). |
| Run scripts | 11 files in `home/.chezmoiscripts/`, all `.sh`/`.sh.tmpl` (bash or sh), including `run_after_00-work-skills.sh.tmpl` (work: clones `.workSkillsRepo` from `.chezmoidata/work.yaml`) | Would all fail on Windows (see §2.2) |
| Modify scripts | `home/private_dot_claude/modify_settings.json.tmpl` (`#!/bin/sh` + `jq`), `home/Library/.../private_rtk/modify_config.toml` (`#!/bin/sh` + `awk`) | No extension, so they fail on Windows. rtk's file lives under `Library/` (mac-only path). |
| Externals | `home/.chezmoiexternal.toml.tmpl`: oh-my-zsh, zsh plugins, p10k, fzf-git.sh, vim-plug, ollama completion | All zsh/vim-only |
| Shell | `dot_zshrc.tmpl`, `dot_zshenv`, `dot_p10k.zsh`, `dot_customterminalrc.tmpl`, `dot_programlangrc.tmpl`, `dot_kubectl_aliases` | zsh-only |
| Packages | `Brewfile` (17 CLIs), `Brewfile.only_mac` (casks), `Brewfile.work` | Need a winget equivalent |
| Bootstrap | `install.sh` (Homebrew + base Brewfile) | Needs a `install.ps1` twin |
| Agent instructions | `home/private_dot_claude/CLAUDE.md.tmpl` → includes `.chezmoitemplates/agents/shell.md` ("The Bash tool runs **zsh**; `/bin/bash` is 3.2") | Wrong on Windows, where the Bash tool is Git Bash |
| Ignore | `home/.chezmoiignore` already ignores `Library`, `.local/bin/herdr-notify` and the herdr-notify script when `ne .chezmoi.os "darwin"` | Windows already falls in that branch |

---

## 1. Bootstrap

### 1.1 winget vs Scoop vs Chocolatey

| | winget | Scoop | Chocolatey |
|---|---|---|---|
| Availability | Part of App Installer on Windows 11, current Windows 10 and Server 2025 ([MS Learn](https://learn.microsoft.com/en-us/windows/package-manager/winget/)) | Installed by a script from a non-admin PowerShell: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser; Invoke-RestMethod -Uri https://get.scoop.sh \| Invoke-Expression` ([Scoop README](https://github.com/ScoopInstaller/Scoop)) | Install needs "an administrative shell". Non-admin install is "a last resort" ([Chocolatey docs](https://docs.chocolatey.org/en-us/choco/setup/)) |
| Admin | Runs unelevated; installers that need elevation trigger UAC ([MS Learn](https://learn.microsoft.com/en-us/windows/package-manager/winget/)) | "Eliminates" UAC prompts; installs to `C:\Users\<you>\scoop` ([README](https://github.com/ScoopInstaller/Scoop)) | Admin by default |
| User-scope installs | `--scope user\|machine` ([install docs](https://learn.microsoft.com/en-us/windows/package-manager/winget/install)). Portable packages go to `%LOCALAPPDATA%/Microsoft/WinGet/Packages/` with a symlink in `%LOCALAPPDATA%/Microsoft/WinGet/Links/`, and that folder is appended to PATH ([winget spec #182](https://github.com/microsoft/winget-cli/blob/master/doc/specs/%23182%20-%20Support%20for%20installation%20of%20portable%20standalone%20apps.md)) | Everything is user-scope; "Prevents polluting the PATH" ([README](https://github.com/ScoopInstaller/Scoop)) | Machine-scope |
| Declarative list | `winget import -i file.json` with `Sources`/`Packages`/`PackageIdentifier`, plus `--ignore-unavailable`, `--no-upgrade`, `--accept-*-agreements`, `--disable-interactivity` ([import docs](https://learn.microsoft.com/en-us/windows/package-manager/winget/import)). `winget configure` takes DSC YAML ([configure docs](https://learn.microsoft.com/en-us/windows/package-manager/winget/configure)) | `scoop install a b c` (no lockfile format in README) | `packages.config` |
| Coverage of this repo's tools | All but tmux and pyenv-win (§4) | All but tmux; lazygit and psfzf are in `extras` (§4) | Not checked |

**Recommendation: winget.** It needs no bootstrap, `winget import` is the closest analogue to
`brew bundle`, and both rtk and Claude Code publish winget IDs in their own docs
([rtk README](https://github.com/rtk-ai/rtk), [Claude Code setup](https://code.claude.com/docs/en/setup)).
Scoop is only needed for a Meslo Nerd Font (the font the mac uses) or pyenv-win, and both can be
skipped (§4).

Caveat: the winget `rtk-ai.rtk` manifests include `1.2.1`, matching the latest GitHub release
`v1.2.1`. Older versions are tagged inconsistently (`v0.50.0` next to `0.51.0`)
([winget-pkgs dir](https://github.com/microsoft/winget-pkgs/tree/master/manifests/r/rtk-ai/rtk),
[rtk releases](https://github.com/rtk-ai/rtk/releases)). Harmless.

### 1.2 Installing chezmoi and the one-liner

- Packages: `winget install twpayne.chezmoi`, `scoop install chezmoi`, `choco install chezmoi`
  ([chezmoi install](https://www.chezmoi.io/install/)).
- Script, from chezmoi's own `install.ps1` (verified in source, `assets/scripts/install.ps1`,
  `.EXAMPLE` block):
  ```powershell
  iex "&{$(irm 'https://get.chezmoi.io/ps1')} -- init --apply <DOTFILE_REPO_URL>"
  ```
  It installs the binary in `./bin` by default (`-b` changes it,
  [chezmoi install](https://www.chezmoi.io/install/)), so the winget route is cleaner.
- `chezmoi init` uses the `git` binary when one is on PATH and falls back to its built-in git
  otherwise (`useBuiltinGit` default `auto`, verified in
  `assets/chezmoi.io/docs/reference/configuration-file/variables.md.yaml`). Git for Windows is
  still wanted for Claude Code's Bash tool and yazi's `file.exe` (§3, §5).

Recommended manual bootstrap, from a normal (non-admin) Windows PowerShell 5.1:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
winget install --id Microsoft.PowerShell -e --source winget
winget install --id Git.Git -e --source winget
winget install --id twpayne.chezmoi -e --source winget
# open a NEW pwsh window so PATH picks up pwsh/git/chezmoi, then:
chezmoi init --apply aviadlevy
```

Open a new `pwsh` before `init` because chezmoi picks the `.ps1` interpreter from PATH when it
starts (§2.2). From a stale 5.1 session, scripts would run under Windows PowerShell 5.1.

---

## 2. chezmoi structure for multi-OS

### 2.1 `.chezmoiignore` keyed on OS

- The file is always a template; patterns match **target** paths, not source names
  ([.chezmoiignore reference](https://www.chezmoi.io/reference/special-files/chezmoiignore/)).
- The official example for Windows:
  ```
  {{- if eq .chezmoi.os "windows" }}
  Documents/*
  !Documents/*PowerShell/ # ignore a folder, except for Windows PowerShell profiles
  {{- end }}
  ```
  ([same page](https://www.chezmoi.io/reference/special-files/chezmoiignore/))
- **Scripts in `.chezmoiscripts/` are matched as `.chezmoiscripts/<name>`**, where the name has the
  `run_`, `once_`/`onchange_`, `before_`/`after_` prefixes and `.tmpl` removed. Verified in
  `readScriptsDir` (`internal/chezmoi/sourcestate.go`, which calls `s.Ignore(targetRelPath)`
  before adding the script) and tested locally:

  | Pattern | Ignores `run_once_a.sh`? |
  |---|---|
  | `.chezmoiscripts/a.sh` | yes |
  | `.chezmoiscripts/*.sh` | **yes, all `.sh` scripts** |
  | `a.sh` / `*.sh` | no |

  The repo's existing `.chezmoiscripts/herdr-notify.sh` pattern already relies on this.
- Externals are filtered the same way (`s.Ignore(externalRelPath)` in `sourcestate.go`), so
  ignoring `.oh-my-zsh` skips downloading it. The `.chezmoiexternal.toml.tmpl` **template still
  renders**, so `gitHubLatestRelease "romkatv/powerlevel10k"` still calls the GitHub API (cached,
  60 req/h unauthenticated:
  [GitHub functions](https://www.chezmoi.io/reference/templates/github-functions/)). This is
  harmless but can be skipped with an `{{ if ne .chezmoi.os "windows" }}` around the zsh block.
- Alternative per-script gate: "If the template resolves to only whitespace or an empty string, the
  script will not be executed"
  ([scripts guide](https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/)). Prefer
  `.chezmoiignore`: it keeps the gate in one place, like the existing darwin block.

### 2.2 How chezmoi runs scripts on Windows

Verified in source (`internal/cmd/interpreters.go`, `internal/cmd/util_windows.go`,
`internal/chezmoi/interpreter.go`, `internal/chezmoi/realsystem.go`):

- chezmoi writes the script to a temp file that keeps the original extension, then picks an
  interpreter **by extension**. The defaults are `.bat`/`.cmd`/`.com`/`.exe` (run directly), `.nu`
  → `nu`, `.pl` → `perl`, `.py` → `python3`, `.rb` → `ruby`, and **`.ps1` → `pwsh -NoLogo -File`,
  or `powershell -NoLogo -File` if `pwsh` is not on PATH**
  ([interpreters doc](https://www.chezmoi.io/reference/configuration-file/interpreters/)).
- With no interpreter, `ExecCommand` runs `exec.Command(tempfile)`. Windows ignores `#!`, so
  **`.sh` and extension-less `modify_` scripts fail**. The interpreters doc says Windows natively
  runs only `.bat`, `.cmd`, `.com` and `.exe`. You *could* set `[interpreters.sh] command = "bash"`
  to run them under Git Bash, but they call `brew`, `launchctl`, `jq` and nvm's `install.sh`, so
  running them there makes no sense.
- Override if needed:
  ```toml
  [interpreters.ps1]
      command = "pwsh"
      args = ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File"]
  ```
  The documented example forces Windows PowerShell with `command = "powershell"`
  ([interpreters doc](https://www.chezmoi.io/reference/configuration-file/interpreters/)). Adding
  `-NoProfile` keeps a slow or broken profile out of every script. `-ExecutionPolicy Bypass`
  avoids depending on the user's policy: profiles and scripts don't run under the `Restricted`
  policy
  ([about_Profiles](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_profiles?view=powershell-7.5)).
  Keep `-File` last, because chezmoi appends the script path after `args`. Put this block inside
  `{{ if eq .chezmoi.os "windows" }}` in `.chezmoi.toml.tmpl`.
- Elevation: chezmoi documents a self-elevating header using
  `Start-Process -Wait -FilePath pwsh.exe -Verb Runas`, with gsudo as an alternative
  ([chezmoi Windows guide](https://www.chezmoi.io/user-guide/machines/windows/)). None of the
  scripts proposed here need admin.
- Line endings for modify templates: `chezmoi:template:line-endings=native|crlf|lf`
  ([template directives](https://www.chezmoi.io/reference/templates/directives/)).

### 2.3 Templates that must change

| Template | Problem | Fix |
|---|---|---|
| `.chezmoi.toml.tmpl` | `output "uname" "-m"`: no `uname` on Windows. Git for Windows' default PATH option ("Recommended") adds only `Git\cmd`; `usr\bin` comes only with the "optional Unix tools" option ([Git for Windows installer source](https://github.com/git-for-windows/build-extra/blob/main/installer/install.iss)) | Delete `uname_arch` (unused), or use the built-in `.chezmoi.arch` |
| `dot_gitconfig.tmpl` | `output "sh" "-c" "git config ... \|\| true"` | `output "git" "config" "--global" "--get" "--default" "" "coderabbit.machineId"` returns empty and exits 0 for a missing key (tested locally with git on macOS). Same behaviour on every OS, no `sh`. |
| `private_dot_claude/CLAUDE.md.tmpl` → `agents/shell.md` | Says "Bash tool runs zsh; /bin/bash is 3.2" (mac facts) | Gate on `.chezmoi.os`. On Windows the Bash tool is Git Bash ([setup](https://code.claude.com/docs/en/setup)) |
| `private_dot_claude/modify_settings.json.tmpl` | `#!/bin/sh` + `jq` | Convert to a modify-template (§2.4) |
| rtk `modify_config.toml` | `#!/bin/sh` + `awk`, mac path only | Shared modify-template in `.chezmoitemplates/`, used at the mac path and `AppData/Roaming/rtk/` (§5.3) |

### 2.4 Cross-OS `modify_` without a shell: `chezmoi:modify-template`

- A `modify_` file containing `chezmoi:modify-template` is run as a template, with the current file
  in `.chezmoi.stdin`. It **must not** have a `.tmpl` extension. The documented example is
  `{{ fromJson .chezmoi.stdin | setValueAtPath "key.nestedKey" "value" | toPrettyJson }}`
  ([manage different file types](https://www.chezmoi.io/user-guide/manage-different-types-of-file/);
  verified in `assets/chezmoi.io/docs/user-guide/manage-different-types-of-file.md`).
- chezmoi has a built-in **`jq` template function** backed by gojq, which "behaves slightly
  differently to the `jq` command in some edge cases"
  ([jq function](https://www.chezmoi.io/reference/templates/functions/jq/)). The existing jq program
  (`def ensure_bash_hook`, `map_values`, `unique`, `any`) can likely move into
  `modify_settings.json` almost verbatim:
  ```
  {{- /* chezmoi:modify-template */ -}}
  {{- $cur := .chezmoi.stdin | default "{}" | fromJson -}}
  {{- $prog := printf `<existing jq program; template data such as .claudePlugins spliced in with %s>` (.claudePlugins | toJson) -}}
  {{- $cur | jq $prog | first | toPrettyJson -}}
  ```
  The `{{ ... }}` blocks inside today's jq program, such as `{{ .claudeMarketplaces | toJson }}`
  and the `{{ if not .work }}` block, have to be built into the program string before calling
  `jq`.
  **Unverified**: that this exact program runs under gojq unchanged. Test it with
  `chezmoi cat ~/.claude/settings.json` on macOS before switching. Gain: one copy for macOS, Linux
  and Windows, and `install.sh` no longer has to install `jq` before the first apply.
- Other built-ins for this: `fromJsonc`, `fromToml`, `toToml`, `setValueAtPath`,
  `deleteValueAtPath`, `replaceAllRegex` (function list in chezmoi source
  `assets/chezmoi.io/docs/reference/templates/functions/`).

### 2.5 Where Windows targets land

Paths are relative to `~` (= `%USERPROFILE%`). chezmoi source names map 1:1 (for example
`home/AppData/Roaming/rtk/...`).

| Target | Source path in `home/` | Source |
|---|---|---|
| `~\Documents\PowerShell\Microsoft.PowerShell_profile.ps1` (pwsh 7, current user, current host) | `Documents/PowerShell/Microsoft.PowerShell_profile.ps1.tmpl` | [about_Profiles](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_profiles?view=powershell-7.5) |
| `%APPDATA%` = `~\AppData\Roaming` | `AppData/Roaming/...` | rtk config dir is `dirs::config_dir()` = `%APPDATA%` on Windows ([rtk proxy/src/main.rs comment](https://github.com/rtk-ai/rtk/blob/master/proxy/src/main.rs)) |
| `%LOCALAPPDATA%` = `~\AppData\Local` | `AppData/Local/...` | Windows Terminal (Store): `%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json`; unpackaged: `%LOCALAPPDATA%\Microsoft\Windows Terminal\settings.json` ([WT install](https://learn.microsoft.com/en-us/windows/terminal/install)) |
| `~\.config\starship.toml` | existing `dot_config/starship.toml` | starship default `~/.config/starship.toml`, override `$ENV:STARSHIP_CONFIG` ([starship config](https://starship.rs/config/)) |
| `%AppData%\yazi\config\` | reuse `dot_config/yazi` with `YAZI_CONFIG_HOME=~\.config\yazi` | ([yazi config](https://yazi-rs.github.io/docs/configuration/overview)) |
| `~\.claude\` | existing `private_dot_claude/` | "On Windows, `~/.claude` means `%USERPROFILE%\.claude`" ([settings](https://code.claude.com/docs/en/settings)) |
| `~\.wezterm.lua` | `dot_wezterm.lua` (if WezTerm) | ([WezTerm config files](https://wezterm.org/config/files.html)) |

**OneDrive caveat.** "The location of the `Documents` folder can be changed by folder redirection
or OneDrive. We don't recommend..."
([about_Profiles](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_profiles?view=powershell-7.5)).
If `$PROFILE` is under `OneDrive\Documents`, the chezmoi target `Documents/PowerShell/...` is the
wrong place. A robust alternative: keep the real profile at `~/.config/powershell/profile.ps1` and
have a small `run_onchange_` `.ps1` script write `. "$HOME\.config\powershell\profile.ps1"` into
whatever `$PROFILE` resolves to.

### 2.6 Symlinks

- Creating a `SymbolicLink` on Windows needs elevation, unless Developer Mode is on (Windows 10
  build 14972+). **Junctions** do not need it
  ([New-Item](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/new-item?view=powershell-7.5)).
  chezmoi likewise needs Developer Mode or `SeCreateSymbolicLinkPrivilege` for `symlink_` entries
  ([chezmoi Windows guide](https://www.chezmoi.io/user-guide/machines/windows/)).
- Turning on Developer Mode "requires administrator access" and may be disabled by an organization
  ([Developer Mode](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development)).
- The repo has no `symlink_` entries. Only `run_after_link-skills.sh.tmpl` creates symlinks, and
  all of them point at **directories**. A `.ps1` port should use
  `New-Item -ItemType Junction`: it works without admin, and since PowerShell 7.4 `-Force`
  overwrites an existing junction (same page).

### 2.7 Line endings / `.gitattributes`

- Git for Windows' installer defaults to "Checkout Windows-style, commit Unix-style"
  (`core.autocrlf=true`)
  ([installer source](https://github.com/git-for-windows/build-extra/blob/main/installer/install.iss),
  `ReplayChoice('CRLF Option','CRLFAlways')`). The chezmoi source clone on Windows would then hold
  CRLF files, chezmoi would copy CRLF into targets, and `.githooks/commit-msg` would carry CRLF.
- `.gitattributes` overrides `core.autocrlf` for the paths it sets: `text`/`eol` fall back to
  `core.autocrlf` only when unspecified ([gitattributes](https://git-scm.com/docs/gitattributes)).
- **Add a repo-root `.gitattributes`** (outside `home/`, so chezmoi doesn't deploy it):
  ```
  * text=auto eol=lf
  ```
  Normalize once with `git add --renormalize .`, as the gitattributes page recommends. pwsh reads
  LF `.ps1` files fine (**unverified** in an official doc; widely relied on).

### 2.8 Externals on Windows

- Archive and file externals work the same way. `git-repo` externals shell out to `git`. Ignored
  targets are skipped (§2.1).
- `my-work-skills` is no longer an external. `run_after_00-work-skills.sh.tmpl` clones it, so a
  work Windows machine needs a `.ps1` twin (git clone/pull with the same SSH warnings) before
  `link-skills.ps1`. It also needs an SSH key that Git for Windows' OpenSSH can use
  (**unverified** details).
- Drop or ignore on Windows: `.oh-my-zsh*`, `.fzf-git.sh` (bash/zsh only), `.vim/autoload/plug.vim`
  (Vim on Windows uses `vimfiles`; **unverified**: not checked against Vim docs).

---

## 3. Shell: PowerShell 7 profile

| Piece | Setup line | Source |
|---|---|---|
| pwsh 7 | `winget install --id Microsoft.PowerShell` (ID verified in winget-pkgs) | [winget-pkgs](https://github.com/microsoft/winget-pkgs/tree/master/manifests/m/Microsoft/PowerShell) |
| PSReadLine | Ships with pwsh 7 (v2.3.6 in 7.4.7/7.5.0, v2.4.5 in 7.6). Predictions are off by default; enable with `Set-PSReadLineOption -PredictionSource History`. History lives in `$Env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine` | [about_PSReadLine](https://learn.microsoft.com/en-us/powershell/module/psreadline/about/about_psreadline) |
| Prompt: **starship** | `Invoke-Expression (&starship init powershell)` at the end of `$PROFILE`; needs a Nerd Font | [starship guide](https://starship.rs/guide/) |
| Prompt: oh-my-posh (alt.) | `winget install JanDeDobbeleer.OhMyPosh --source winget`; `oh-my-posh font install meslo` (user font dir when not admin) | [OMP Windows](https://ohmyposh.dev/docs/installation/windows), [OMP fonts](https://ohmyposh.dev/docs/installation/fonts) |
| zoxide | `Invoke-Expression (& { (zoxide init powershell \| Out-String) })` | [zoxide README](https://github.com/ajeetdsouza/zoxide) |
| fzf keybindings: PSFzf | From PSGallery or Scoop (`extras`). Needs `fzf` on PATH. `Set-PsFzfOption -PSReadlineChordProvider 'Ctrl+t' -PSReadlineChordReverseHistory 'Ctrl+r'`; Alt+c is the default for set-location | [PSFzf](https://github.com/kelleyma49/PSFzf) |
| fnm (node) | `fnm env --use-on-cd --shell powershell \| Out-String \| Invoke-Expression`; reads `.nvmrc` / `.node-version` | [fnm](https://github.com/Schniz/fnm) |
| uv completion | `(& uv generate-shell-completion powershell) \| Out-String \| Invoke-Expression` | [uv install](https://docs.astral.sh/uv/getting-started/installation/) |
| yazi | `YAZI_FILE_ONE` must point at Git for Windows' `file.exe` (`C:\Program Files\Git\usr\bin\file.exe`), "the ONLY way we recommend" | [yazi install](https://yazi-rs.github.io/docs/installation/) |

**Prompt choice: starship.** p10k is zsh-only. The repo already has `home/dot_config/starship.toml`,
and starship reads the same path on Windows, so there is no second prompt config to maintain.
oh-my-posh has a built-in font installer but needs a new theme file. Nothing ties the repo to it.

Port `dot_customterminalrc.tmpl` into the profile, keeping its semantics:

- Keep the `CLAUDECODE` guard: when `$env:CLAUDECODE` is set, don't alias `ls`→eza, `cat`→bat or
  `cd`→z. Note that pwsh has built-in aliases (`ls`, `cat`, `cd`), so overriding one needs
  `Set-Alias -Force` or `Remove-Item Alias:ls`. **Unverified** which built-ins are `AllScope`.
- Port the `y()` yazi cwd wrapper: same logic, `--cwd-file`, then `Set-Location`.
- Wrap each block in `{{ if lookPath "eza" }}` as today. `lookPath` finds `.exe` on Windows.

---

## 4. Package availability on Windows

Verified 2026-11-27 by checking that the manifest directory exists in
[`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs/tree/master/manifests) and the
manifest JSON in [`ScoopInstaller/Main`](https://github.com/ScoopInstaller/Main/tree/master/bucket) /
[`Extras`](https://github.com/ScoopInstaller/Extras/tree/master/bucket) via the GitHub API.
"404" = not present.

| Brewfile entry | winget ID | Scoop | Notes |
|---|---|---|---|
| chezmoi | `twpayne.chezmoi` | main/`chezmoi` | |
| git (implicit) | `Git.Git` | main/`git` | Also provides Git Bash and `file.exe` |
| bat | `sharkdp.bat` | main/`bat` | |
| eza | `eza-community.eza` | main/`eza` | Listed in [eza INSTALL.md](https://github.com/eza-community/eza/blob/main/INSTALL.md) |
| fd | `sharkdp.fd` | main/`fd` | |
| fzf | `junegunn.fzf` | main/`fzf` | fzf's README lists only bash/zsh/fish/nushell integration, so use PSFzf ([fzf](https://github.com/junegunn/fzf)) |
| gh | `GitHub.cli` | main/`gh` | |
| git-delta | `dandavison.delta` | main/`delta` | Delta needs a "reasonably recent" `less` ([delta install](https://dandavison.github.io/delta/installation.html)); **unverified** whether Git for Windows' `less` is new enough |
| jq | `jqlang.jq` | main/`jq` | Not needed by chezmoi if §2.4 is done |
| lazygit | `JesseDuffield.lazygit` | **extras**/`lazygit` (not main) | |
| ripgrep | `BurntSushi.ripgrep.MSVC` | main/`ripgrep` | rtk shells out to `rg` ([rtk install](https://www.rtk-ai.app/docs/getting-started/installation/)) |
| rtk | `rtk-ai.rtk` (versions up to 1.2.1) | main/`rtk` (1.2.1, homepage rtk-ai.app) | winget is preferred by rtk because it "handles PATH". The Claude hook is native (`rtk hook claude`) since v0.37.2, with no bash or jq needed ([rtk install](https://www.rtk-ai.app/docs/getting-started/installation/)) |
| tmux | **404** | **404** | No native build. Use Windows Terminal panes (Alt+Shift+D etc., [WT install](https://learn.microsoft.com/en-us/windows/terminal/install)), WezTerm, or Herdr/`hc` |
| vim | `vim.vim` | main/`vim` | |
| neovim (alt.) | `Neovim.Neovim` | main/`neovim` | |
| yazi | `sxyazi.yazi` | main/`yazi` | Needs `YAZI_FILE_ONE` (§3) |
| zoxide | `ajeetdsouza.zoxide` | main/`zoxide` | |
| pyenv | **404** (no `pyenv-win` on winget) | main/`pyenv` = pyenv-win 3.1.1 | Prefer `uv python install`, which adds the versioned executable to PATH; `--default` (experimental) adds `python`/`python3` ([uv Python guide](https://docs.astral.sh/uv/guides/install-python/)) |
| nvm (script) | `CoreyButler.NVMforWindows` | main/`nvm` (2.0.1) | nvm-windows v2 needs no admin rights ([nvm-windows](https://github.com/coreybutler/nvm-windows)) |
| fnm (alt. to nvm) | `Schniz.fnm` | main/`fnm` | **Recommended**: one PATH line, reads `.nvmrc` ([fnm](https://github.com/Schniz/fnm)) |
| uv | `astral-sh.uv` | main/`uv` | Also `irm https://astral.sh/uv/install.ps1 \| iex` ([uv](https://docs.astral.sh/uv/getting-started/installation/)) |
| zsh | n/a | n/a | Not ported |
| starship | `Starship.Starship` | main/`starship` | |
| oh-my-posh (alt.) | `JanDeDobbeleer.OhMyPosh` | main/`oh-my-posh` | |
| PSFzf | PSGallery | extras/`psfzf` | |
| gsudo (optional) | `gerardog.gsudo` | main/`gsudo` | Suggested by chezmoi for elevation |
| Claude Code | `Anthropic.ClaudeCode` | — | winget installs don't auto-update unless `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE=1`; the native installer does ([setup](https://code.claude.com/docs/en/setup)) |

`Brewfile.only_mac` casks:

| Cask | Windows | Notes |
|---|---|---|
| ghostty | **None.** "The Ghostty project only officially distributes prebuilt binaries for macOS" ([Ghostty](https://ghostty.org/docs/install/binary)); no winget manifest (404) | Use **Windows Terminal** (`Microsoft.WindowsTerminal`, default PowerShell profile, panes) or **WezTerm** (`wez.wezterm`, config `~/.wezterm.lua`) |
| font-meslo-lg-nerd-font | Not on winget (no `DEVCOM.MesloLGSNerdFont`); `DEVCOM.JetBrainsMonoNerdFont` exists | Scoop: bucket `nerd-fonts` (= `matthewjberger/scoop-nerd-fonts`, listed in Scoop's [buckets.json](https://github.com/ScoopInstaller/Scoop/blob/master/buckets.json)) `Meslo-NF`; or `oh-my-posh font install meslo`. [Nerd Fonts README](https://github.com/ryanoasis/nerd-fonts) lists Scoop/Choco/PowerShell options |
| notion, spotify, zen | `Notion.Notion`, `Spotify.Spotify`, `Zen-Team.Zen-Browser` | |
| rectangle | — | `Microsoft.PowerToys` (FancyZones; **unverified** feature claim, not fetched) |
| raycast | No `Raycast.Raycast` in winget (404) | PowerToys Run as a substitute (**unverified**) |
| orbstack | No (mac-only) | Docker Desktop or WSL2 |
| aldente, keycastr, terminal-notifier | mac-only | Skip |

`Brewfile.work` spot checks: `GLab.GLab`, `MikeFarah.yq`, `Amazon.AWSCLI`, `Helm.Helm`,
`Kubernetes.kubectl`, `ahmetb.kubectx`, `SlackTechnologies.Slack`,
`Microsoft.VisualStudioCode` all exist in winget-pkgs. The rest is not checked.

---

## 5. Claude Code, rtk, Herdr on Windows

### 5.1 Claude Code

From [code.claude.com/docs/en/setup](https://code.claude.com/docs/en/setup):

- Native install: `irm https://claude.ai/install.ps1 | iex` (PowerShell), or `install.cmd` (CMD).
  "You do not need to run as Administrator." Native installs auto-update in the background.
- It installs to `%USERPROFILE%\.local\bin\claude.exe`, with versions in
  `%USERPROFILE%\.local\share\claude` (from the uninstall instructions). This is the same layout as
  Unix, so the existing `run_once_after_00-claude-code.sh` check (`~/.local/bin/claude`) ports
  directly as `Test-Path "$HOME\.local\bin\claude.exe"`.
- Git for Windows is **optional** but recommended. With it, the Bash tool uses Git Bash (set
  `CLAUDE_CODE_GIT_BASH_PATH` if it isn't found). Without it, Claude uses the PowerShell tool. The
  PowerShell tool is also on by default alongside Bash for claude.ai accounts. Sandboxing is **not
  supported** on native Windows; it is on WSL2.
- `winget install Anthropic.ClaudeCode` is the alternative. It doesn't auto-update unless
  `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE=1`.
- Settings: `~/.claude` = `%USERPROFILE%\.claude`; `CLAUDE_CONFIG_DIR` overrides
  ([settings](https://code.claude.com/docs/en/settings)). The existing
  `home/private_dot_claude/` tree deploys there unchanged.
- **Hooks** in `settings.json` (`yoram-nudge.sh`, `require-ship.sh`): shell-form hooks run in **Git
  Bash on Windows**, or PowerShell when Git Bash is missing. Without Git Bash, a failing
  `PreToolUse` shell-form hook **blocks** the action unless it exits 0 or 2
  ([hooks](https://code.claude.com/docs/en/hooks)). So Git for Windows is effectively **required**
  for this repo's `.sh` hooks. **Unverified**: whether `{{ .chezmoi.homeDir }}` renders with
  forward slashes on Windows; Git Bash accepts `C:/Users/...`, but backslashes would need quoting.
  Check with `chezmoi execute-template '{{ .chezmoi.homeDir }}'` on the machine.

### 5.2 Claude plugins and skills scripts

- `run_onchange_after_claude-plugins.sh.tmpl` uses bash arrays and `jq`. Port it to `.ps1` with
  `claude plugin list --json | ConvertFrom-Json`. Keep the same `toJson | sha256sum` onchange hash
  comment.
- `run_after_link-skills.sh.tmpl`: port to `.ps1` with directory **junctions** (§2.6). The
  "real path, skip" and "prune dangling" logic maps to `Get-Item ... .LinkType`.

### 5.3 rtk

- `winget install rtk-ai.rtk`, then `rtk init -g`. The hook is a native binary, with no bash or jq
  ([rtk install](https://www.rtk-ai.app/docs/getting-started/installation/)).
- Config: `%APPDATA%\rtk\config.toml` (`dirs::config_dir()` is "%APPDATA% on Windows",
  [rtk source comment](https://github.com/rtk-ai/rtk/blob/master/proxy/src/main.rs); the main
  binary uses the same `dirs::config_dir()` per `src/core/user_dirs.rs`).
- The `exclude_commands` pin becomes a modify-template in
  `.chezmoitemplates/rtk-config` that does the `[hooks]` edit with `replaceAllRegex`.
  `fromToml | setValueAtPath | toToml` is the simpler option but drops comments. Two one-line
  callers then use it: `Library/.../private_rtk/modify_config.toml` and
  `AppData/Roaming/rtk/modify_config.toml`.

### 5.4 Herdr

I read `https://releases.herdr.dev/app/install.ps1` (103 lines) and the `core/install.ps1` it
calls (106 lines) on 2026-11-27:

- **x64 only**: it fails with "no build for $arch Windows yet (x64 only)" otherwise. It needs
  `curl.exe` and `%SystemRoot%\System32\tar.exe`, and deliberately avoids Git Bash's `tar`.
- The app goes to `%LOCALAPPDATA%\Programs\herdr-app\herdr-app.exe` with a Start-menu `Herdr.lnk`.
  The folder is appended to the **user** `Path` in HKCU (raw value, `%VARS%` preserved). "No
  admin" is needed.
- It verifies the download's SHA-256 against `app/latest.json`. There is **no signature check**,
  unlike the macOS `install.sh` comment in this repo, which mentions a code-signature check.
- If `herdr-core` is missing, it runs `core/install.ps1`. That installs to
  `%LOCALAPPDATA%\Programs\herdr-core` (override `HC_INSTALL_DIR`), checks SHA-256, adds the folder
  to the user PATH and **hard-links `hc.exe`** to `herdr-core.exe` if no `hc` exists. Rerunning
  updates in place.
- Port: `run_once_after_herdr-app.ps1` with
  `if (Test-Path "$env:LOCALAPPDATA\Programs\herdr-app\herdr-app.exe") { exit 0 }`, then
  `irm https://releases.herdr.dev/app/install.ps1 | iex`.
- **Unverified**: where herdr-app reads `settings.json`/`keys.json` on Windows. The repo deploys
  `~/.config/herdr-app/`, and `https://releases.herdr.dev/` returned 404, so no doc was found.
  Check on the machine before porting `dot_config/herdr-app`.

---

## 6. WSL2 as a complement

- `wsl --install` needs an **admin** PowerShell. It installs Ubuntu by default, and new installs
  default to WSL 2 ([WSL install](https://learn.microsoft.com/en-us/windows/wsl/install)).
- chezmoi reports `.chezmoi.os == "linux"` inside WSL. Detect WSL with
  `.chezmoi.kernel.osrelease | lower | contains "microsoft"`
  ([chezmoi Windows guide](https://www.chezmoi.io/user-guide/machines/windows/)).
- **Can the Linux path run unchanged?** Very likely yes. `tests/docker/run.sh` passes on fresh
  `ubuntu:24.04` with only git/curl/build-essential added, and WSL's default distro is Ubuntu.
  The steps are the same: `install.sh` → Linuxbrew → `chezmoi init --apply`. **Unverified**: this
  was not run inside an actual WSL2 instance. Likely differences:
  - Keep the repo and projects on the Linux filesystem (`/home/<user>`), not `/mnt/c`, for
    performance ([WSL filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)).
  - Windows' PATH is shared into WSL, so `lookPath "fzf"` etc. could find Windows `.exe` files on
    `/mnt/c/...` if Linuxbrew's copy is missing. Interop runs Windows tools from Linux
    ([WSL filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)). Mitigation
    (**unverified**, not fetched): `appendWindowsPath=false` in `/etc/wsl.conf`.
  - `herdr-app` and playwright's Chromium are GUI apps. They need WSLg (**unverified**).
  - `alias o="open ."` doesn't work on Linux in general. In WSL, `explorer.exe .` works
    ([WSL filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)).
- Claude Code in WSL2: install with the Linux installer inside WSL. It **supports sandboxing**,
  which native Windows doesn't ([setup](https://code.claude.com/docs/en/setup)).
- Native Windows and WSL keep **separate** `~/.claude`, chezmoi source and tool installs. They are
  two machines as far as chezmoi is concerned.

**Use WSL2 for Linux-toolchain work and native Windows for Windows-native projects.** The Claude
Code docs frame the choice the same way.

---

## 7. Recommendation: minimum viable Windows support

Ordered by value. Each step leaves `chezmoi apply` green on macOS and Linux.

### Step 1: make `chezmoi init --apply` not crash on Windows (required, small)

1. `home/.chezmoi.toml.tmpl`: drop `uname_arch` (unused) or set it to `.chezmoi.arch`. Add the
   Windows-only `[interpreters.ps1]` block (§2.2).
2. `home/dot_gitconfig.tmpl`: replace `output "sh" ...` with
   `output "git" "config" "--global" "--get" "--default" "" "coderabbit.machineId"`.
3. `home/.chezmoiignore`: add
   ```
   {{ if eq .chezmoi.os "windows" }}
   # zsh stack, bash scripts and mac/linux-only config
   .chezmoiscripts/*.sh
   .zshrc
   .zshenv
   .p10k.zsh
   .customterminalrc
   .programlangrc
   .kubectl_aliases
   .vimrc
   .vim
   .oh-my-zsh
   .fzf-git.sh
   .config/ghostty
   .config/cmux
   {{ else }}
   .chezmoiscripts/*.ps1
   Documents
   AppData
   {{ end }}
   ```
   The `.chezmoiscripts/*.sh` pattern is tested (§2.1). The existing `ne "darwin"` block already
   covers `Library` and herdr-notify.
4. Repo root `.gitattributes`: `* text=auto eol=lf` (§2.7).
5. Gate `.chezmoitemplates/agents/shell.md` on OS (Git Bash on Windows, not zsh).

### Step 2: bootstrap and packages

6. Repo-root `install.ps1` (Windows twin of `install.sh`): install `Microsoft.PowerShell`,
   `Git.Git` and `twpayne.chezmoi` with
   `winget install --id <ID> -e --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity`,
   then print "open a new pwsh and run `chezmoi init --apply aviadlevy`" (§1.2).
7. Repo-root `winget.json` (base) and `winget.work.json`, in `winget import` format. They mirror
   `Brewfile`/`Brewfile.work` with the IDs from §4.
8. `home/.chezmoiscripts/run_onchange_after_zz-winget-import.ps1.tmpl`: a twin of
   `zz-brew-bundle`. Its hash comment uses `include (joinPath .chezmoi.workingTree "winget.json") | sha256sum`
   (same trick as today), and it runs
   `winget import -i <file> --ignore-unavailable --no-upgrade --accept-package-agreements --accept-source-agreements --disable-interactivity`
   per file.

### Step 3: Claude Code (the highest-value tool here)

9. Rewrite `private_dot_claude/modify_settings.json.tmpl` as `modify_settings.json` using
   `chezmoi:modify-template` + `jq` (§2.4). This gives one copy for all OSes. Test on macOS first:
   `chezmoi diff ~/.claude/settings.json` must be empty.
10. `run_once_after_00-claude-code.ps1`: `Test-Path ~\.local\bin\claude.exe`, else
    `irm https://claude.ai/install.ps1 | iex`.
11. `run_onchange_after_claude-plugins.ps1.tmpl`, `run_after_link-skills.ps1.tmpl` (junctions)
    (§5.2) and, for work, `run_after_00-work-skills.ps1.tmpl`.

### Step 4: PowerShell profile

12. `home/Documents/PowerShell/Microsoft.PowerShell_profile.ps1.tmpl`. Contents: PSReadLine
    options, starship, zoxide, PSFzf, fnm, uv completion, eza/bat aliases with the `CLAUDECODE`
    guard, `y` for yazi, `$env:YAZI_CONFIG_HOME = "$HOME\.config\yazi"`, and `$env:YAZI_FILE_ONE`
    (§3). Gate each block on `lookPath`, as `dot_customterminalrc.tmpl` does. Mind the OneDrive
    caveat (§2.5).
13. PSFzf installs from the profile or a run script:
    `Install-Module PSFzf -Scope CurrentUser` (PSGallery; **unverified**: exact command not quoted
    on the PSFzf page).

### Step 5: rtk and Herdr

14. Shared rtk modify-template, plus `home/AppData/Roaming/rtk/modify_config.toml` (§5.3).
15. `run_once_after_herdr-app.ps1` (§5.4). Leave `dot_config/herdr-app` ignored on Windows until
    its config path is confirmed.

### Step 6: nice to have

16. `fnm install --lts` in a run script, then port `run_onchange_after_00-playwright-cli`
    (`npm i -g @playwright/cli`).
17. Terminal font. Either set `profiles.defaults.font.face` in Windows Terminal's settings through
    a modify-template with `fromJsonc | setValueAtPath | toPrettyJson` (this strips comments), or
    add `dot_wezterm.lua` if WezTerm wins.
18. A CI smoke test on a Windows runner: `chezmoi init --apply` from the working tree, then check
    the tools are on PATH, mirroring `tests/docker/run.sh`. **Unverified**: not checked whether
    GitHub's Windows runners ship winget.

### Deliberately not ported

| Item | Why |
|---|---|
| zsh, oh-my-zsh, zsh plugins, p10k, `.p10k.zsh` | zsh-only. starship covers the prompt from the existing config |
| tmux | No native Windows build (§4). Windows Terminal panes, WezTerm or Herdr instead |
| Ghostty, cmux configs | No Windows build (§4) |
| herdr-notify + LaunchAgent | launchd/macOS notifications |
| `dot_programlangrc` bits (pyenv shims, rbenv, sdkman, opam, gcloud, graphviz CFLAGS) | Per-tool Unix shell glue. Use uv for Python and fnm for node |
| nvm `install.sh` script | Replaced by fnm on Windows |
| `run_onchange_after_shell-completions` (zsh fpath cache) | pwsh completions are one profile line each |
| `.kubectl_aliases`, `.vimrc`, vim-plug | Low value on Windows. Revisit with neovim if needed |
| Mac casks (aldente, rectangle, raycast, keycastr, orbstack, terminal-notifier) | macOS-only. Install Windows substitutes manually if wanted |

---

## Sources

- chezmoi: [install](https://www.chezmoi.io/install/), [Windows](https://www.chezmoi.io/user-guide/machines/windows/), [interpreters](https://www.chezmoi.io/reference/configuration-file/interpreters/), [.chezmoiignore](https://www.chezmoi.io/reference/special-files/chezmoiignore/), [scripts](https://www.chezmoi.io/user-guide/use-scripts-to-perform-actions/), [machine differences](https://www.chezmoi.io/user-guide/manage-machine-to-machine-differences/), [file types / modify-template](https://www.chezmoi.io/user-guide/manage-different-types-of-file/), [jq function](https://www.chezmoi.io/reference/templates/functions/jq/), [template directives](https://www.chezmoi.io/reference/templates/directives/), [GitHub functions](https://www.chezmoi.io/reference/templates/github-functions/), source [twpayne/chezmoi](https://github.com/twpayne/chezmoi) (`internal/cmd/interpreters.go`, `internal/cmd/util_windows.go`, `internal/chezmoi/interpreter.go`, `internal/chezmoi/realsystem.go`, `internal/chezmoi/sourcestate.go`, `assets/scripts/install.ps1`)
- Microsoft: [winget overview](https://learn.microsoft.com/en-us/windows/package-manager/winget/), [winget install](https://learn.microsoft.com/en-us/windows/package-manager/winget/install), [winget import](https://learn.microsoft.com/en-us/windows/package-manager/winget/import), [winget configure](https://learn.microsoft.com/en-us/windows/package-manager/winget/configure), [winget portable spec](https://github.com/microsoft/winget-cli/blob/master/doc/specs/%23182%20-%20Support%20for%20installation%20of%20portable%20standalone%20apps.md), [winget-pkgs](https://github.com/microsoft/winget-pkgs), [about_Profiles](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_profiles?view=powershell-7.5), [about_PSReadLine](https://learn.microsoft.com/en-us/powershell/module/psreadline/about/about_psreadline), [New-Item](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/new-item?view=powershell-7.5), [Developer Mode](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development), [Windows Terminal install](https://learn.microsoft.com/en-us/windows/terminal/install), [WSL install](https://learn.microsoft.com/en-us/windows/wsl/install), [WSL filesystems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)
- Scoop: [README](https://github.com/ScoopInstaller/Scoop), [buckets.json](https://github.com/ScoopInstaller/Scoop/blob/master/buckets.json), [Main](https://github.com/ScoopInstaller/Main), [Extras](https://github.com/ScoopInstaller/Extras); Chocolatey: [setup](https://docs.chocolatey.org/en-us/choco/setup/)
- Claude Code: [setup](https://code.claude.com/docs/en/setup), [settings](https://code.claude.com/docs/en/settings), [hooks](https://code.claude.com/docs/en/hooks)
- Tools: [rtk README](https://github.com/rtk-ai/rtk), [rtk install](https://www.rtk-ai.app/docs/getting-started/installation/), [starship guide](https://starship.rs/guide/), [starship config](https://starship.rs/config/), [oh-my-posh Windows](https://ohmyposh.dev/docs/installation/windows), [oh-my-posh fonts](https://ohmyposh.dev/docs/installation/fonts), [zoxide](https://github.com/ajeetdsouza/zoxide), [PSFzf](https://github.com/kelleyma49/PSFzf), [fzf](https://github.com/junegunn/fzf), [fnm](https://github.com/Schniz/fnm), [nvm-windows](https://github.com/coreybutler/nvm-windows), [uv install](https://docs.astral.sh/uv/getting-started/installation/), [uv Python](https://docs.astral.sh/uv/guides/install-python/), [yazi install](https://yazi-rs.github.io/docs/installation/), [yazi config](https://yazi-rs.github.io/docs/configuration/overview), [delta install](https://dandavison.github.io/delta/installation.html), [eza INSTALL](https://github.com/eza-community/eza/blob/main/INSTALL.md), [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts), [Ghostty binaries](https://ghostty.org/docs/install/binary), [WezTerm config files](https://wezterm.org/config/files.html), [Git for Windows installer](https://github.com/git-for-windows/build-extra/blob/main/installer/install.iss), [gitattributes](https://git-scm.com/docs/gitattributes)
- Herdr: `https://releases.herdr.dev/app/install.ps1` and `https://releases.herdr.dev/core/install.ps1` (read 2026-11-27); `https://releases.herdr.dev/` returned 404
