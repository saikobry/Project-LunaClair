---
name: terminal-orchestrator
description: Coordinate interactive terminal AI agents (Codex, Kilo, Cline, OpenCode, Antigravity CLI) in Herdr on Windows using explicit task completion callbacks, gitignored staging, and structured reports.
metadata:
  short-description: Terminal agent orchestrator inside Herdr
---

# Terminal Orchestrator

Agent-agnostic multi-worker orchestrator inside **Herdr** (native Windows multiplexer). Coordinates interactive terminal agents (Codex, Kilo, OpenCode, Cline, Antigravity CLI) with hands-off execution, gitignored staging, and structured artifact delivery.

Governed by root [AGENTS.md](../../../AGENTS.md) (`User Preferences`): parent agents yield after dispatch and wake on worker completion callback.

---

## Default Workflow: Explicit Task Completion Callback

Delegated work uses **explicit completion callbacks**. Herdr working/idle statuses are diagnostic hints, not proof of task completion. The parent dispatches a task, yields its turn, receives a completion callback from the worker, and reviews the final report artifact.

```text
+------------------+       1. dispatch.ps1 (-ReturnPane)       +------------------+
|   Parent Agent   | ----------------------------------------> |   Worker Agent   |
|   (e.g. Codex)   |                                           |  (e.g. agy/kilo) |
|                  | <---------------------------------------- |                  |
+------------------+     3. complete-task.ps1 (Callback)       +--------+---------+
         |                                                              |
         | 4. get-report.ps1 -TaskId                                    | 2. Writes
         v                                                              v
+---------------------------------------------------------------------------------+
|              Gitignored Staging (.orchestrator/tasks/ & reports/)               |
+---------------------------------------------------------------------------------+
```

### 1. Parent Dispatches Task and Yields

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 `
  -Worker <worker_name_or_pane> `
  -Spec .orchestrator/specs/<spec_file>.md `
  -ReturnPane <parent_pane_id> `
  -Report .orchestrator/reports/<report_file>.md
```

- Persists task metadata to `.orchestrator/tasks/<taskId>.json` (gitignored). Task creation is exclusive (`CreateNew`) to prevent race collisions.
- Automatically formats the prompt with the completion recipe.
- Verifies delivery to the worker pane, then exits.
- **Parent Action**: Yield turn immediately. Do **not** poll worker status, read panes, or monitor in a model loop.

### 2. Worker Implements and Completes Task

After all work and verification are finished, the worker invokes the completion helper:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/complete-task.ps1 `
  -TaskId <taskId> `
  -Report .orchestrator/reports/<report_file>.md `
  -Summary "Finished implementation and verified tests"
```

- Validates report artifact exists, is regular, non-empty, and fresher than dispatch time.
- Computes SHA-256 digest (`reportHash`) and persists completion state atomically before sending notification. `Write-AtomicJsonFile` uses Win32 `ReplaceFileW` with zero `Move-Item` fallback, preserving the last good record on disk.
- Guards against duplicate callbacks via OS-level file lock and atomic delivery claim (`pending`, `in_flight`, `delivered`, `delivery_failed`, `unnotified`, `no_return_pane`).
- Retries on interrupted delivery require explicit operator `-Force` and preserve original artifact evidence without re-hashing.
- Delivers `TERMINAL_ORCHESTRATOR_TASK_COMPLETED` callback to `-ReturnPane` via bounded transport without waiting on the parent.

### 3. Parent Receives Callback and Reviews Report

Parent wakes on the incoming callback prompt:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -TaskId <taskId>
```

- Fast-path verifies task completion metadata, regular non-empty report, and SHA-256 integrity before outputting content.
- Parent performs single final review on the generated artifacts and git diff.

---

## Flash Worker Profile (`agy`)

When coordinating `agy` on a Flash model, delegate substantive research and implementation to native `self` subagents per [AGENTS.md](AGENTS.md) (`Local Contracts` -> `Flash Delegation Profile`).

### Execution Recipe

1. **Minimal Scoping**: Read applicable DOX contracts, define task boundaries, and avoid pre-investigating the full solution in coordinator context.
2. **Early Subagent Dispatch**:
   ```json
   invoke_subagent({
     "TypeName": "self",
     "Model": "inherit",
     "Role": "<2-5 word role>",
     "Prompt": "<self-contained brief with target paths, constraints, and verification>"
   })
   ```
3. **Subagent Execution & Return**: Subagent executes changes and reports back with changed paths, technical rationale, verification results, and concise evidence (targeted excerpts only when review requires them).
4. **Synthesis & Callback**: Coordinator inspects the git diff, verifies against task-specific contracts, and sends the completion callback via `complete-task.ps1`.

---

## Secondary Modes

### 1. One-Shot Consultation (`consult.ps1`)
Use for rapid peer review or second opinions on diffs or plans without tool execution:

```powershell
# Review git changes with explicitly pinned main session ID:
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/consult.ps1 codex -SessionId codex:123 -Changes -Topic "Review Storage Refactor"

# Review staged diff only:
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/consult.ps1 codex -StagedDiff -Topic "Pre-commit Review"

# Inline prompt review:
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/consult-inline.ps1 codex .orchestrator/specs/design-review.md
```

*Note: No-tools consultations rely on heuristic lifecycle waiting because tool-less reviewers have no permissions to execute completion callbacks. Transcript output is labeled as transcript evidence, distinct from task completion evidence.*

### 2. Heuristic Lifecycle Waiting (`wait-agent.ps1`)
Diagnostic socket-level wait for an agent to return to idle or done in Herdr:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-agent.ps1 -Workers <worker_name_or_pane> -RequireActivity
```

- `herdr agent wait` blocks at the OS named-pipe level.
- Emits `TERMINAL_ORCHESTRATOR_LIFECYCLE_IDLE` when quiet. Does not prove task completion.
- `-RequireActivity` enforces that candidates transitioned through `working` or `blocked` in both `-Mode All` and `-Mode Any`.

---

## Core Invariants

1. **Hands-Off Execution**: Governed by root [AGENTS.md](../../../AGENTS.md) (`User Preferences`): yield immediately after dispatch, wake on callback.
2. **Workspace Root Resolution**: Scripts accept `-WorkspaceRoot` or auto-resolve to the containing workspace, ensuring identical path resolution from subdirectories.
3. **Inline Argument Budget**: Keep inline prompts under 20,000 characters. Pass larger instructions via a spec file.
4. **Safe Composition**: Never send ctrl+c (exits Codex CLI) or Escape (re-opens previous turn) to clear worker composers.
5. **Git Hygiene**: All ephemeral specs, tasks, and reports reside under `.orchestrator/` (auto-excluded in `.git/info/exclude`).
6. **Session Identity**: Provider namespace for agy is antigravity-cli. Pinned session IDs (`-SessionId`, supported in `consult.ps1`) or task IDs (`-TaskId`) prevent cross-session pollution; unpinned session lookup queries `agentsview session get <id> --json` and fails closed on ambiguous correspondence.

---

## Script Inventory

Located in `.agents/skills/terminal-orchestrator/scripts/`:

- `dispatch.ps1`: Task dispatcher with delivery confirmation, exclusive task registration, and parameter validation.
- `complete-task.ps1`: Worker completion helper with atomic locking, SHA-256 digest validation, and parent callback delivery.
- `get-report.ps1`: Structured report retrieval by TaskId, SessionId, or worker via AgentsView with bounded stream drains.
- `wait-agent.ps1`: Diagnostic lifecycle waiting with activity enforcement.
- `consult.ps1`: Automated packaging and consultation for git diffs.
- `consult-inline.ps1`: Inline prompt consultation avoiding argument re-splitting.
- `clean.ps1`: Staging cleaner for `.orchestrator/` with directory containment enforcement.

For multi-agent delegation patterns (Pair Programmer, Sequential, Parallel, Council, Scout), see [references/topologies.md](references/topologies.md).
For Windows command-line quoting and Herdr transport quirks, see [references/platform-limits.md](references/platform-limits.md).
