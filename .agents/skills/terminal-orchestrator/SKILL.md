---
name: terminal-orchestrator
description: >-
  Agent-agnostic multi-worker orchestrator inside Herdr (native Windows multiplexer).
  Dispatches tasks to one or multiple terminal agents (Freebuff, OpenCode, Codex,
  Kilo, Cline, Claude, etc.) in token-saver pairing (Architect + Pair Programmer),
  scout & specialist, parallel (Divide & Conquer), sequential (Builder + Reviewer),
  or broadcast (Council) using gitignored staging, Herdr lifecycle monitoring,
  and structured transcript reading primarily via AgentsView.
---

# Terminal Orchestrator Skill

A universal, agent-agnostic multi-worker orchestrator that coordinates interactive terminal AI agents running natively inside **Herdr** (native Windows multiplexer).

Supported agents include: **Codex**, **Kilo**, **OpenCode**, **Freebuff**, **Cline**, and **Antigravity CLI**.

---

## Why Use This Workflow?

1. **Native Windows & Agent-Agnostic:** Runs directly on Windows via Herdr's named-pipe JSON-RPC server (`\\.\pipe\herdr.sock`), controlling native CLIs without WSL overhead.
2. **Token Economics (Lead Architect + Pair Programmer):** Expensive, high-reasoning models (e.g. Codex on `gpt-5.6-luna xhigh`) design surgical changes and review diffs, while fast, cheap models (e.g. Kilo, Cline, or OpenCode) execute file edits, AST transforms, formatting, and test runs.
3. **Pure Prompts (Zero Sentinel Pollution):** Prompts contain 100% pure task specifications. No messy instructions forcing agents to create `.done` files via shell commands.
4. **Hands-Off Execution (Zero Token Burn):** The orchestrator dispatches with `-Wait` and lets Herdr block at the OS socket level (`\\.\pipe\herdr.sock`). It never polls, watches, or step-monitors workers in a model loop.
5. **Real-Time Lifecycle Awareness:** Herdr actively tracks agent states (`idle`, `working`, `blocked`, `done`). If an agent blocks on a question or permission dialog, the wait loop warns immediately instead of hanging.
6. **Primary Session Intelligence via AgentsView:** Transcripts, assistant answers, thought blocks, tool calls, and token usage are read cleanly through **AgentsView** — avoiding terminal scrollback limits, soft-wrapping artifacts, or alternate-screen buffer truncation.
7. **Clean Git Status (Gitignored Runtime):** Task specifications and ephemeral reports are staged in `.orchestrator/` (automatically excluded in `.git/info/exclude`). Working trees stay 100% pristine.

---

## Zero-Token Hands-Off Rule for AI Orchestrators

> [!IMPORTANT]
> **NEVER poll or step-monitor workers in an AI model loop.**
> - Calling `herdr pane read`, `herdr agent read`, or `herdr agent list` repeatedly across multiple agent turns sends full conversation contexts back and forth to the LLM, burning tokens and context window for zero utility.
> - Dispatch with `dispatch.ps1 -Wait` (or run `wait-agent.ps1`) and **let the process block synchronously** until Herdr completes, or stop calling tools until a background notification arrives.
> - Herdr's reactive socket wait (`herdr agent wait`) blocks at the OS named-pipe level. It consumes **zero LLM tokens** and zero CPU.
> - Inspect output **only once** after completion using `get-report.ps1` via AgentsView. The only valid mid-flight intervention is if Herdr reports the agent is `[BLOCKED]` waiting on human approval.

---

## Architecture: Herdr (Execution) + AgentsView (Observation)

The orchestrator operates on a clean separation of concerns:

- **Herdr = Execution & Process Engine**: Handles multiplexer layout, terminal panes, keystrokes, bracketed paste submission (`herdr agent prompt`), process management, and live lifecycle states (`idle`, `working`, `blocked`).
- **AgentsView = Observation & Intelligence Engine**: Ingests, parses, and indexes structured session JSONL files from all agents in real time. Serves as the **primary source of truth** for reading worker conclusions, tool executions, and tokens.

```
       ┌─────────────────────────────────────────────────────────┐
       │                Orchestrator / Dispatcher                │
       └──────────────┬───────────────────────────▲──────────────┘
                      │                           │
         1. Dispatch via Herdr       3. Read clean transcripts
            (bracketed-paste)           primarily via AgentsView
                      │                           │
                      ▼                           │
       ┌─────────────────────────────┐   ┌────────┴──────────────┐
       │     Herdr Terminal Panes    │──►│      AgentsView       │
       │ (Codex, Kilo, Cline, etc.)  │   │   (Session Archive)   │
       └─────────────────────────────┘   └───────────────────────┘
```

---

## Reading Sessions Primarily via AgentsView

Instead of relying on lossy terminal screen scraping, use `agentsview` CLI commands as the primary interface to read what workers did:

### 1. Identify Recent Sessions
List active and completed sessions across any agent:
```powershell
# List all sessions active in the last 2 hours:
agentsview session list --since 2h --include-one-shot

# Filter by a specific agent kind:
agentsview session list --since 4h --include-one-shot --json | ConvertFrom-Json
```

### 2. Extract the Final Assistant Response
Retrieve the un-truncated markdown response of a worker turn:
```powershell
# Get the latest assistant message:
agentsview session messages <session_id> --role assistant --direction desc --limit 1

# Or view the last 3 assistant turns with thinking blocks:
agentsview session messages <session_id> --role assistant --direction desc --limit 3
```

### 3. Inspect Tool Calls & Execution History
Audit exactly which commands or edits the worker executed:
```powershell
# List all tool calls made during the session:
agentsview session tool-calls <session_id>
```

### 4. Check Token Usage & Costs
Verify resource consumption:
```powershell
agentsview session usage <session_id>
```

### 5. Live Viewport Fallback (Herdr)
Use `herdr agent read` or `herdr pane read` **only as a fallback**:
- When inspecting an interactive dialog or permission prompt when the agent is `blocked`.
- When an agent has not yet flushed its session log to disk.
```powershell
herdr agent read <target> --source recent-unwrapped --lines 80
# Or for raw pane IDs:
herdr pane read <pane_id> --source recent-unwrapped --lines 80
```

---

## Runtime Architecture (`.orchestrator/`)

All ephemeral orchestration files are staged in `.orchestrator/` (automatically excluded in `.git/info/exclude`):

```text
.orchestrator/
├── specs/          # Task specifications (e.g. step1.md, backend.md)
└── reports/        # Aggregated multi-worker reports
```

---

## Automation Scripts

Located in: `.agents/skills/terminal-orchestrator/scripts/`

- **`dispatch.ps1`**:
  Verifies targets (Herdr agent name or pane ID, e.g. `kilo-scout`, `cline`, `w3:p5`), stages the spec, formats a clean task prompt, and delivers via Herdr (`herdr agent prompt` or `herdr pane send-text`).
  - **Dynamic On-Demand Auto-Spawning**: If a requested worker (e.g. `kilo-scout`, `codex`, `opencode`) is not currently running in Herdr, `dispatch.ps1` automatically creates a new pane to the right (`herdr pane split --current --direction right --no-focus`), boots the agent (`herdr agent start <name> --kind <kind> --pane <id>`), awaits interactive readiness, and proceeds with dispatch.
  - `-Worker <name|pane_id> -Spec <path>`: Single worker dispatch.
  - `-Workers "w3:p5,codex" -Spec <path>`: Broadcast spec to multiple workers.
  - `-Target @{ "w3:p5" = "spec1.md"; cline = "spec2.md" }`: Parallel dispatch with distinct specs.
  - `-Wait`: Synchronously blocks until the worker completes its turn in Herdr.
  - `-TimeoutSeconds <sec>`: Maximum wait duration (default 300s).

- **`wait-agent.ps1`**:
  Monitors completion via Herdr's native lifecycle tracking.
  - `-Workers "w3:p5,codex,cline"`: Workers/panes to wait on.
  - `-Mode All` (default): Wakes up when **all** specified workers return to `idle` or `done`.
  - `-Mode Any`: Wakes up when **any** specified worker completes (first-responder).
  - Actively inspects `herdr agent list` during polling; alerts immediately if any worker transitions to `blocked` (waiting on human input/approval).

- **`get-report.ps1`**:
  **Primarily uses AgentsView** to extract the worker's structured assistant conclusion with explicit source attribution (`Source: AgentsView` vs `Source: Herdr Terminal Buffer`).
  - **Step 0 Auto-Sync**: Automatically runs an incremental `agentsview sync` (~500ms) before querying, ensuring all in-flight SQLite WAL frames and un-indexed JSONLs are ingested into the database. (Bypass with `-NoSync`).
  - Session resolution follows a strict 4-tier strategy:
    1. **Herdr Live Inventory**: Uses `agent_session.value` if the agent socket reports an active session ID (e.g. Kilo, Codex).
    2. **Targeted AgentsView Query**: Runs `agentsview session list --agent <agentName> --include-one-shot --limit 5 --json`, selecting the session matching the current workspace `cwd`.
    3. **Windowed AgentsView Query**: Scans recent sessions within the last 4 hours matching worker name.
    4. **Herdr Buffer Fallback**: Takes an 80-line terminal viewport snapshot only if AgentsView hasn't indexed the session.
  - `-Workers "codex,kilo-scout,cline"`: Resolves and formats reports side-by-side.
  - `-Limit <int>`: Max assistant turns to retrieve (default: 3).
  - `-NoSync`: Skips the initial incremental `agentsview sync` step.
  - `-OutputFile <path>`: Optionally saves combined markdown report.

- **`clean.ps1`**:
  Wipes temporary specs and reports in `.orchestrator/`.
  - `-All`: Clears all temporary staging files.

---

## Core Multi-Worker Topologies

### 1. Lead Architect + Pair Programmer (Token-Saver Pairing)
*High-reasoning model designs changes; fast/free model executes tools, file edits, and tests.*

1. **Lead Architect (e.g. Codex in `w3:p6`) writes dense spec**:
   - Stages `.orchestrator/specs/step1.md` with exact logic, paths, and test cases.
2. **Dispatch to Pair Programmer (e.g. Kilo in `w4:p7` or Cline in `w3:p3`)**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker kilo-scout -Spec .orchestrator/specs/step1.md -Wait
   ```
3. **Read Output via AgentsView**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers kilo-scout
   ```
4. **Review & Guide**:
   - Architect checks `git diff` and test results.
   - If clean, advance to `step2.md`; if adjustments needed, send corrective spec.

---

### 2. Builder + Reviewer (Sequential Pipeline)
*Worker 1 writes the implementation; Worker 2 acts as an independent QA reviewer auditing edge cases.*

1. **Dispatch build task to Worker 1**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker opencode-worker -Spec .orchestrator/specs/build.md -Wait
   ```
2. **Retrieve report via AgentsView**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers opencode-worker
   ```
3. **Dispatch review task to Worker 2**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker codex -Spec .orchestrator/specs/review-and-test.md -Wait
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers codex
   ```

---

### 3. Divide & Conquer (Parallel Execution)
*Split a feature into independent scopes (e.g. API/Schema vs UI/Components) and run two agents concurrently.*

1. **Draft specs in `.orchestrator/specs/`**:
   - `.orchestrator/specs/backend.md`
   - `.orchestrator/specs/frontend.md`
2. **Dispatch concurrently**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Target @{ "w3:p4" = ".orchestrator/specs/backend.md"; "w4:p7" = ".orchestrator/specs/frontend.md" }
   ```
3. **Wait for both workers via Herdr**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-agent.ps1 -Workers "w3:p4,w4:p7" -Mode All
   ```
4. **Fetch aggregated reports via AgentsView**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers "w3:p4,w4:p7"
   ```

---

### 4. Scout & Specialist (Token-Saver Context & Peer Verdict)
*Worker 1 reads raw files/ASTs, distills context into a dense markdown dossier, and provides its own insider verdict. Worker 2 acts as the external peer judge, cross-examining the dossier and verdict without reading raw code.*

1. **Dispatch Scout (Worker 1, e.g. Kilo or Cline)**:
   Spec instructs Worker 1 to scan code and write `.orchestrator/specs/<feature>-dossier.md` with structured facts + its own insider verdict.
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker kilo-scout -Spec .orchestrator/specs/scout-task.md -Wait
   ```
2. **Dispatch External Peer Judge (Worker 2, e.g. Codex)**:
   Spec points Worker 2 to read the scout's dossier and deliver its cross-verdict (Concur, Dissent, or Add Nuance):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker codex -Spec .orchestrator/specs/peer-review-task.md -Wait
   ```
3. **Retrieve Unified Intelligence via AgentsView**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers "kilo-scout,codex"
   ```

---

### 5. Council / Dual-Perspective (Cross-Validation)
*Broadcast the same complex problem or architectural design to multiple agents (e.g. Codex, Kilo, Cline) to evaluate trade-offs and compare solutions.*

1. **Broadcast spec to all council workers**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Workers "codex,kilo-scout,cline" -Spec .orchestrator/specs/architectural-design.md
   ```
2. **Wait for all proposals via Herdr**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/wait-agent.ps1 -Workers "codex,kilo-scout,cline" -Mode All
   ```
3. **Retrieve and compare reports via AgentsView**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/get-report.ps1 -Workers "codex,kilo-scout,cline"
   ```
