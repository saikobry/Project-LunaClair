# Freebuff ↔ Herdr integration

Reference for the integration that is being removed from this skill. Covers the **Herdr
plugin** and the separate **`freebuff-herdr`** launcher, and explains why both exist.

For `prompt.js` specifically, see [README.md](./README.md).

## Identity

| | |
|---|---|
| Plugin id | `freebuff.integration` |
| Upstream | `github:TheMetalStorm/herdr-freebuff-plugin` |
| Pinned commit | `a49b1ea428fe6eb620288a3035984073927557d2` |
| Manifest | `~/.herdr/plugins/freebuff/herdr-plugin.toml` (outside this repo) — owns the pane and action surface |
| Min Herdr | `0.7.0` |

Inspect the installed copy with `herdr plugin list`. The plugin config directory is reported
there (`%APPDATA%\herdr\plugins\config\freebuff.integration`).

## Two copies of the plugin exist

| Path | Origin |
|---|---|
| `~/.herdr/plugins/freebuff/` | local checkout, and the path `prompt.js` resolves first |
| `%APPDATA%\herdr\plugins\github\freebuff.integration-9c8369eb58e8/` | the installed plugin |

They were byte-identical when vendored (same SHA-256). **Edit the local copy** — it is the one
`freebuff-prompt.ps1` loads — and expect the installed copy to be overwritten by a plugin
reinstall.

## Two lifecycle paths, and why `freebuff-herdr` is the one that works

The plugin ships a watcher; the npm launcher ships a different one. They are not the same
code, and only the second was observed to produce a pane Herdr tracks.

### Plugin path (pane entrypoint)

```
herdr plugin pane  →  sh scripts/launch.sh task
                   →  ~/.local/bin/freebuff        (wrapper, installed by the setup action)
                   →  sh scripts/status-watcher.sh
```

- The wrapper at `~/.local/bin/freebuff` spawns the watcher **only** when `HERDR_ENV=1` **and**
  `HERDR_PANE_ID` are set. Otherwise it starts nothing — no error, no warning.
- `status-watcher.sh` reads Freebuff's chat state from `~/.config/manicode/projects/*/chats/`
  (path resolution verified working under Git Bash on Windows) and reports to
  `herdr pane report-agent`.
- It also exits 0 silently when `HERDR_ENV` is unset (`status-watcher.sh`, the guard on line 15).

### `freebuff-herdr` path (npm global, PowerShell)

```
herdr pane run <pane> "freebuff-herdr"
               →  freebuff-herdr.ps1     (npm global, NOT part of the plugin)
               →  herdr pane report-metadata + report-agent
               →  node status-watcher.js
```

- Gates on the same `HERDR_ENV=1` + `HERDR_PANE_ID` pair, so it must be run **inside** a
  Herdr pane.
- Keeps its sequence counter in memory rather than in a file.
- Calls `herdr pane release-agent` in a `finally` block when Freebuff exits.

## Pane registration is the whole game

Herdr tracks a pane only after it has been registered. `freebuff-herdr` performs that
registration, and **releases it on exit** — so:

- A pane launched any other way never reports `agent_status` beyond its initial value.
- After `freebuff-herdr` exits, that pane ignores `report-agent` permanently. Verified: a
  direct `herdr pane report-agent <pane> --state working --seq <large>` returned exit 0 and
  changed nothing.
- **A de-registered pane cannot be recovered.** Only a newly created pane registers.

Working sequence:

```powershell
herdr pane split --current --direction right --no-focus   # split takes only right|down
herdr pane run <new-pane-id> "freebuff-herdr"
```

`herdr pane focus --direction` accepts `left|right|up|down`, but `herdr pane split --direction`
accepts **only `right|down`**.

Herdr has no `freebuff` agent kind, so `herdr agent start --kind freebuff` fails with
`unsupported interactive agent kind`. Herdr's supported kinds are listed by
`herdr agent start --help`.

## Agent detection

`config/agent-detection/freebuff.toml` declares the pane's agent identity. Field names follow
Herdr's detection manifest schema, verifiable with `herdr api schema --json`:

```toml
[[agent]]
name = "freebuff"
match_cmdline = ["freebuff"]
alt_cmdline = ["manicode/freebuff"]
```

`scripts/common.sh` seeds this into Herdr's agent-detection config directory.

## Herdr plugin CLI surface

`install`, `uninstall`, `link`, `unlink`, `enable`, `disable`, `list`, `config-dir`, `action`,
`log` (alias `logs`), `pane`.

The plugin contributes three panes (`task`, `resume-last`, `resume-named`) and two actions
(`setup`, `notify`). Pane entrypoints are required rather than actions because an interactive
TUI needs a real PTY, which plugin actions and the CLI do not provide.

## Known defects in the plugin

1. **Windows-invalid sequence filename.** `status-watcher.sh` builds its counter path as
   `${TMPDIR:-/tmp}/herdr-freebuff-seq-${PANE_ID}`. A pane id contains `:`, which is illegal
   on NTFS, and Git Bash rewrites it — observed as `herdr-freebuff-seq-w3?p6`. Herdr discards
   reports whose sequence is not newer, so a mangled or colliding path silently freezes the
   pane's reported state. **Does not affect the `freebuff-herdr` path**, which keeps its counter
   in memory.
2. **Silent no-op gate.** Both watchers exit 0 without doing anything when the `HERDR_ENV`
   check fails. There is no diagnostic, so a misconfigured pane looks identical to a healthy
   idle one.
3. **Sequential-companion logic, not parallel.** Both watchers classify one newest chat
   directory and report a single state. Nothing in either path can report several workers at
   once, which is why the orchestrator's broadcast topologies fall through to a different
   transport for Freebuff.

## Removal checklist

1. Delete `.agents/skills/terminal-orchestrator/vendor/freebuff/`.
2. Remove the `freebuff-prompt.ps1` section and Freebuff Transport 0 from `SKILL.md`.
3. Remove Transport 0 and the `freebuff*` kind mapping from `scripts/dispatch.ps1`.
4. Remove the Freebuff entry from `scripts/consult.ps1`, `consult-inline.ps1`, and
   `wait-agent.ps1` where they enumerate workers.
5. `herdr plugin uninstall freebuff.integration` on the machine.
6. Optionally `herdr plugin disable freebuff.integration` if the plugin is shared.

Steps 5 and 6 are machine-local and cannot be performed from this repository.
