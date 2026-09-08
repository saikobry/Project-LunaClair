---
name: terminal-orchestrator
description: >-
  Agent-agnostic multi-worker orchestrator inside WSL tmux. Dispatches tasks
  to one or multiple terminal agents (Freebuff, OpenCode, Codex, Claude, etc.)
  in parallel (Divide & Conquer), sequentially (Builder + Reviewer), or broadcast
  (Council / Cross-Validation) using gitignored staging, per-worker sentinels,
  autonomous wait loops, and unified reports via AgentsView.
---

# Terminal Orchestrator Skill

A universal, agent-agnostic multi-worker orchestrator that coordinates interactive terminal AI agents running inside WSL `tmux` (such as **Freebuff**, **OpenCode**, **Codex**, **Claude Code**, or **Aider**).

---

## Why Use This Workflow?

1. **Agent-Agnostic & Decentralized:** Works with any terminal AI. The dispatcher can be Antigravity, OpenCode, Codex, or a human engineer; workers can be any mix of models and CLIs.
2. **Multi-Worker Topologies:** Coordinates 1, 2, or *N* terminal agents simultaneously (parallel split, sequential review pipeline, or consensus council).
3. **Clean Git Status (Gitignored Runtime):** Task specifications, per-worker sentinel flags, and ephemeral reports are staged in `.orchestrator/`, which is in `.gitignore`. Repo working trees stay 100% pristine.
4. **Per-Worker Sentinel Flags:** Each worker signals completion via its own isolated sentinel (`.orchestrator/sentinels/<session>.done`), avoiding race conditions or collision.
5. **Autonomous Handoff:** Background wait loops wake up automatically upon sentinel creation without human polling.
6. **Token Economics:** Consumes only the single final assistant report per worker from `agentsview`, skipping tens of thousands of tokens of intermediate CLI logs.

---

## Runtime Architecture (`.orchestrator/`)

All ephemeral orchestration files are contained within `.orchestrator/` (tracked in `.gitignore`):

```
.orchestrator/
├── specs/          # Task specifications (e.g. backend.md, frontend.md)
├── sentinels/      # Per-worker completion flags (e.g. codex.done, opencode2.done)
└── reports/        # Aggregated multi-worker reports from agentsview
```

---

## Automation Scripts

Located in: `.agents/skills/terminal-orchestrator/scripts/`

- **`dispatch.ps1`**:
  Verifies tmux sessions, prepares staging, removes stale sentinels, formats the clean prompt, and types/submits it to each target worker.
  - `-Worker <name> -Spec <path>`: Single worker dispatch.
  - `-Workers "worker1,worker2" -Spec <path>`: Broadcast the same spec to multiple workers.
  - `-Target @{ worker1 = "spec1.md"; worker2 = "spec2.md" }`: Parallel dispatch with distinct specs.
- **`wait-sentinel.ps1`**:
  Background waiter that polls for worker completion flags.
  - `-Workers "worker1,worker2"`: Workers to wait on.
  - `-Mode All` (default): Wakes up when **all** specified workers complete.
  - `-Mode Any`: Wakes up when **any** specified worker completes (first-responder).
  - Removes completed sentinels and exits with code 0 upon reactive wakeup.
- **`get-report.ps1`**:
  Queries `agentsview` to pull the final assistant summary messages for all specified workers.
  - `-Workers "worker1,worker2"`: Resolves and outputs reports side-by-side / sequentially.
- **`clean.ps1`**:
  Wipes active sentinels and ephemeral run state in `.orchestrator/`.

---

## The Three Multi-Worker Workflows

### 1. Divide & Conquer (Parallel Execution)
*Split a feature into independent scopes (e.g. API/Schema vs UI/Components) and run two agents concurrently.*

1. **Draft specs in `.orchestrator/specs/`**:
   - `.orchestrator/specs/task-worker1.md`
   - `.orchestrator/specs/task-worker2.md`
2. **Dispatch concurrently**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Target @{ freebuff = ".orchestrator/specs/task-worker1.md"; opencode2 = ".orchestrator/specs/task-worker2.md" }
   ```
3. **Launch background waiter**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-sentinel.ps1 -Workers "freebuff,opencode2" -Mode All
   ```
4. **Fetch aggregated reports**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers "freebuff,opencode2"
   ```

---

### 2. Builder + Reviewer (Sequential Pipeline)
*Worker 1 writes the implementation; Worker 2 acts as an independent QA reviewer writing test suites or auditing edge cases.*

1. **Dispatch build task to Worker 1**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker freebuff -Spec .orchestrator/specs/build.md
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-sentinel.ps1 -Workers "freebuff"
   ```
2. **Retrieve Worker 1's report and stage Review spec**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers "freebuff"
   ```
3. **Dispatch review task to Worker 2**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker opencode2 -Spec .orchestrator/specs/review-and-test.md
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-sentinel.ps1 -Workers "opencode2"
   ```

---

### 3. Council / Dual-Perspective (Cross-Validation)
*Broadcast the same complex problem or architectural design to both agents to evaluate trade-offs and compare solutions.*

1. **Broadcast spec to all council workers**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Workers "freebuff,opencode2" -Spec .orchestrator/specs/architectural-design.md
   ```
2. **Wait for all proposals**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-sentinel.ps1 -Workers "freebuff,opencode2" -Mode All
   ```
3. **Retrieve and compare reports**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers "freebuff,opencode2"
   ```

---

### 4. Scout & Specialist (Token-Saver Context & Peer Verdict)
*Worker 1 reads raw files/ASTs, distills context into a dense markdown dossier, and provides its own insider verdict. Worker 2 acts as the external peer judge, cross-examining the dossier and verdict without reading raw code.*

1. **Dispatch Scout (Worker 1)**:
   Spec instructs Worker 1 to scan code, write `.orchestrator/specs/<feature>-dossier.md` with structured facts + its own insider verdict, and touch sentinel:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker freebuff -Spec .orchestrator/specs/scout-task.md
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-sentinel.ps1 -Workers "freebuff"
   ```
2. **Dispatch External Peer Judge (Worker 2)**:
   Spec points Worker 2 to read the scout's dossier and deliver its cross-verdict (Concur, Dissent, or Add Nuance):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker opencode2 -Spec .orchestrator/specs/peer-review-task.md
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-sentinel.ps1 -Workers "opencode2"
   ```
3. **Retrieve Unified Intelligence**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers "freebuff,opencode2"
   ```

---

## The Sentinel Rule
Every task specification must explicitly instruct the worker:
> *"When all checks pass and you are completely finished, create the completion sentinel file: `.orchestrator/sentinels/<session>.done` (in PowerShell: `New-Item -ItemType File -Path .orchestrator/sentinels/<session>.done -Force | Out-Null`; in Bash: `touch .orchestrator/sentinels/<session>.done`)."*
