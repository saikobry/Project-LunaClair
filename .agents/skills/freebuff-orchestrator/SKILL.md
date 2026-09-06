---
name: freebuff-orchestrator
description: >-
  Orchestrates Freebuff as an interactive terminal subagent inside WSL tmux.
  Use when delegating heavy coding tasks, file refactors, and test loops to Freebuff
  while preserving real-time terminal visibility on screen, autonomous task handoff
  via sentinel files, and minimal Antigravity token usage via AgentsView.
---

# Freebuff Orchestrator Skill

This skill codifies the multi-agent pairing workflow between **Antigravity** (Tech Lead / Architect / Dispatcher) and **Freebuff** (Visible Terminal Worker in WSL `tmux`).

---

## Why Use This Workflow?

1. **Full Screen Visibility:** Freebuff runs inside an interactive WSL `tmux` session visible in Windows Terminal. The user can watch thinking, streaming tokens, colors, and tool executions live.
2. **No Terminal Paste Truncation:** Task specifications are staged in a local markdown file (`docs/<task>-spec.md`). The terminal prompt sent to Freebuff is always a clean 1-liner (`Please read <file> and implement...`).
3. **Autonomous Handoff (Zero Human Polling):** Freebuff creates a `.freebuff_done` sentinel upon finishing. Antigravity runs a background waiter task that triggers an automatic reactive wakeup as soon as Freebuff finishes.
4. **Token Economics (~300 tokens/turn):** Antigravity never slurps 20,000 tokens of raw Freebuff tool traces into context. It fetches only the single final assistant summary report from `agentsview`.

---

## Tool Scripts Directory

All reusable automation scripts are located in:
`.agents/skills/freebuff-orchestrator/scripts/`

- **`dispatch.ps1`**: Verifies WSL `tmux` session `freebuff`, removes stale `.freebuff_done`, formats the 1-liner prompt, and sends it via `wsl tmux send-keys`.
- **`wait-done.ps1`**: Background waiter that polls for `.freebuff_done`, deletes it when found, and exits with code 0.
- **`get-report.ps1`**: Automatically resolves the latest Freebuff session ID from `agentsview` and prints only the single final assistant report.

---

## Step-by-Step Execution Runbook

### Step 1: Draft the Task Specification
Create a detailed, self-contained specification file under `docs/`:
`docs/<task>-spec.md`

Must include:
- Context & Goal
- Explicit file paths to create or modify
- Code snippets / signatures / interfaces
- Mandatory verification steps (`npm run test:run`, `npm run lint`, etc.)
- **The Sentinel Rule:** Explicit instruction: *"When all checks pass and you are completely finished, run `touch .freebuff_done` in the project root."*

### Step 2: Dispatch the Task
Run `dispatch.ps1` via `run_command`:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/freebuff-orchestrator/scripts/dispatch.ps1 docs/<task>-spec.md
```

### Step 3: Launch the Autonomous Waiter Task
Run `wait-done.ps1` in the background with `WaitMsBeforeAsync: 500`:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/freebuff-orchestrator/scripts/wait-done.ps1
```

*End turn immediately. Do not poll. The Antigravity engine will automatically wake up when `.freebuff_done` is touched.*

### Step 4: On Reactive Wakeup, Fetch the Report
When the background waiter finishes, run `get-report.ps1`:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/freebuff-orchestrator/scripts/get-report.ps1
```

### Step 5: Independent Verification & Delivery
Run Vitest or TypeScript build checks if necessary, then present the verified accomplishments to the user.
