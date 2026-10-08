# Vendored: Freebuff Herdr prompt runner

`prompt.js` is a **vendored copy** of a file that normally lives outside this repository.

| | |
|---|---|
| Upstream | Freebuff Herdr plugin (`herdr-plugin.toml`, `id = "freebuff.integration"`) |
| Canonical location | `~/.herdr/plugins/freebuff/scripts/prompt.js` |
| Fallback location | `%APPDATA%\herdr\plugins\github\freebuff.integration-*/scripts/prompt.js` |
| SHA-256 | `44D4B4F4A5A5002A625A7D8E2BD62A927FDF262CC47202BE41852115C7C1FD3F` |

`scripts/freebuff-prompt.ps1` resolves this file at runtime from the locations above. It is
**not** executed from this directory — nothing in `scripts/` reads `vendor/`.

## Why it is vendored here

The Freebuff account was banned, so the integration is being removed from this skill. The
plugin's own files are untracked by that plugin's git, so upstream has **no history** for
this file. Without a copy in this repository, the delivery fixes below would be lost with no
way to recover them.

## What was changed from upstream

Five defects were fixed. Each is commented in the file.

1. **False success signal.** The submit loop treated the composer's `Add to the current task`
   placeholder as delivery confirmation. That placeholder renders in *both* states — an empty
   composer and one holding an unsubmitted multi-KB attachment card — so the script reported
   "Prompt delivered" on prompts that never ran (3 of 6 dispatches, observed).
2. **Flat settle time.** Absorption time was capped at 2.5s regardless of prompt size,
   applying the same budget to a 100-char and a 4,200-char paste. Now scaled by length.
3. **No re-focus on retry.** An unfocused pane drops keystrokes via Windows ConPTY, so
   retrying Enter alone could not recover from a failed first attempt.
4. **Unconditional success report.** Printed "Prompt delivered" regardless of outcome.
   Now exits non-zero when submission cannot be confirmed.
5. **Focus stolen without restore.** Caller focus was only restored when `-Wait` was passed.

Submission is verified from Herdr's `agent_status`, with a transcript fallback for turns that
complete between polls (see `screenShowsAnsweredTurn`).

## Reinstalling

```powershell
Copy-Item .agents\skills\terminal-orchestrator\vendor\freebuff\prompt.js `
          "$env:USERPROFILE\.herdr\plugins\freebuff\scripts\prompt.js" -Force
```

Verify the SHA-256 matches the table above.

## Note

Freebuff's Terms of Service prohibit using third-party wrappers or automation to access the
service, and require that a human initiate each session and remain present. This runner is
retained for reference only and must not be re-enabled against the service.
