# Local setup notes

## Layout switching

- The person doesn't want the shipped `main` ("Herdr") or `terminals` layouts; `mine` is their main.
  Shipped layouts can't be deleted (rewritten on start), so `global` keys switch directly:
  `cmd-alt-shift-1` mine, `-2` flockbook, `-3` office, `-4` win98. Add new layouts to this list.

## Flockbook layout (added 2026-11-26)

- From https://github.com/minchenlee/flockbook/tree/main/herdr-app, copied by hand (not via
  `flockbook-modfeed install`): `layouts/flockbook.json`, `mods/flockbook/`, `themes/flockbook*.json`,
  and a `layout:flockbook` section in `keys.json`. Other layouts and keys were left as they were.
- Mod is from repo `main` (commit 7a0231e); helper `flockbook/bin/flockbook-modfeed` is release v0.14.1
  (sha256 checked, notarized). The helper lacks `resources` and `open-check`, so those mod features stay off.
- To update: download the newer `flockbook-modfeed-universal-apple-darwin` + `SHA256SUMS` from the
  release, verify, replace `flockbook/bin/flockbook-modfeed`. Don't run its `install` (it writes layouts/keys).
- To remove: delete the files above and the `layout:flockbook` key section.

## Redline + Auto Title (added 2026-11-26, on trial)

- Redline (github.com/iampedii/herdr-redline @ cac2ee1): `mods/redline/`, global key `ctrl-shift-f`
  (its default `cmd-shift-f` is the person's `pane.zoom`, kept). Uses `glab`; review worktrees go in
  `~/.herdr/worktrees/`. Remove: delete the mod folder and the key.
  Local change (re-apply after updating Redline): `launcher.js` `reviewOptions` adds a "Peer review"
  option that starts Claude with `/peer-review <MR web_url>` as its first message. And `start()` opens the
  review tab in the space Redline was opened from (`this.originSpace`) instead of a new child space.
- Auto Title (github.com/kryptamine/herdr-auto-title v0.25.0): `mods/auto-title/` (popup, `cmd-alt-t`) plus
  a launchd service `io.github.kryptamine.herdr-auto-title` installed by hand (checksum-verified).
  Log: `~/Library/Logs/herdr-auto-title.log`. Checks GitHub daily for updates. Remove:
  `~/Library/Application\ Support/herdr-auto-title/bin/herdr-auto-title desktop uninstall`,
  then delete the mod folder and the key.

## Office layout (added 2026-11-26, on trial)

- From https://github.com/DustyPolk/herdr-office (commit c6222de): `layouts/office.json`,
  `layouts/office.svg`, `mods/office/`, and a `layout:office` section in `keys.json` (`ctrl-shift-i`).
- Weather is off (`WEATHER = false` in `mods/office/main.js`); with it off there is no network and no exec.
- To remove: switch away from it, delete those files and the `layout:office` key section.
