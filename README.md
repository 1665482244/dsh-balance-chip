# dsh-balance-chip

[English](README.md) | [中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web
client plugin that shows your DeepSeek account balance at the bottom-left of
the chat composer — immediately to the right of the permission-switch (切换权限)
button — and refreshes it live.

## Features

- **Live balance pill**: `● 余额 ¥14.07` next to the permission switch.
  - Fetches on mount, polls every 15 s while the tab is visible, refetches on
    window focus, on session switch, and whenever a submitted turn finishes —
    so the balance tracks spend near-instantly.
  - Hover shows the full breakdown (total / topped-up / granted).
  - Click opens the DeepSeek Open Platform user console (`platform.deepseek.com/usage`)
    in a new tab.
- **Balance alert (余额预警)**: Settings → General → 余额预警 sets a warning
  threshold (per-browser `localStorage`, `0` disables). When the primary
  balance drops to (or below) the threshold, the pill's border, text, and dot
  turn red and pulse softly (`prefers-reduced-motion` respected).
- **Host route**: `GET /api/dsh/balance` queries `GET {baseURL}/user/balance`
  using the same credentials as the built-in DeepSeek provider — the stored
  `DEEPSEEK_API_KEY` credential (process env → stored value), against
  `https://api.deepseek.com` (or a trusted `DEEPSEEK_BASE_URL` launch layer).

## Install

The plugin is a DSH profile bundle. From `$DSH_HOME/profiles/web`:

```sh
# link a local checkout
dsh plugin --profile web add "link:<absolute path to this repo>"

# or install straight from GitHub
dsh plugin --profile web add "git+https://github.com/1665482244/dsh-balance-chip.git"
```

Then restart `dsh web` (or relaunch the desktop app). The plugin is
hot-reloadable afterwards: edits to `lib/client.js` are picked up by DSH's
client HMR without a page refresh.

> Note: like all third-party plugins, review the code before installing. The
> host half reads your `DEEPSEEK_API_KEY` credential and sends it only to the
> configured DeepSeek endpoint.

## Layout

```
package.json        # dsh.bundle.patch + dsh.client.web declaration
cordis.patch.yml    # loader entry insertion
lib/index.js        # host half: balance route (ESM, runs in the web server)
lib/client.js       # client half: ModuleLoader bundle (runs in the browser)
```

## Status legend

- green dot — balance fetched successfully.
- amber dot — fetching.
- red dot — lookup failed (e.g. no `DEEPSEEK_API_KEY` credential yet); hover
  shows the reason.
- red border + pulsing — balance at or below the configured alert threshold.

## License

MIT
