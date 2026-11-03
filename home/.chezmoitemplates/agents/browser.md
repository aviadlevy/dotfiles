## Browser

Browse the web with `playwright-cli` in the **signed-in session**: a persistent Chromium profile
logged in to the user's accounts. Open it with
`playwright-cli -s=agent open --browser=chromium --persistent`, then pass `-s=agent` on every
command. `--browser=chromium` is required: the default launches the user's own Chrome.

- **Site not signed in:** reopen the session with `--headed` and ask the user to sign in; the user
  types the credentials.
