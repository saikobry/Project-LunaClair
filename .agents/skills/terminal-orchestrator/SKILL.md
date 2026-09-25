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
> - **PRAGMATIC DISPATCH CONTRACT FOR AI ASSISTANTS**:
>   1. **Default Posture — Chill & Prioritize the Script**: Upon dispatching a task or sending an agent prompt, launch `wait-agent.ps1` (or use `-Wait`). If running in the background, yield your turn and let the OS socket do the waiting. Do not routinely poll or step-monitor panes.
>   2. **Bounded Diagnostic Peeking (Rare Exceptions Only)**: Peeking is not dogmatically banned, but must be strictly limited. If `wait-agent.ps1` times out, throws an error, or Herdr reports an agent is `[BLOCKED]`, take a single, targeted look (e.g. `herdr pane read <pane> --lines 30`) to diagnose or unblock, then return to waiting. Never loop or spam inspection tools across normal working turns.
>   3. **Trust Delivery Confirmation, Not Speed**: `dispatch.ps1` verifies that the worker actually entered `working` before reporting success, and exits non-zero otherwise. A worker that goes idle immediately therefore means "the prompt never landed" (check the pane) — not "the task finished instantly". Reports are freshness-bounded (`get-report.ps1 -SinceIso`, set automatically by `consult.ps1`), so a turn older than the dispatch is never presented as the answer; `TERMINAL_ORCHESTRATOR_NO_NEW_TURN` means "no verdict yet", never "here is the previous one".

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
  Verifies targets (Herdr agent name or pane ID, e.g. `kilo-scout`, `cline`, `w3:p5`), stages the spec, formats a clean task prompt, and delivers via a three-step transport ladder, then **confirms delivery**.
  - **Transport ladder**: (1) any prompt up to the **20,000-char inline budget** goes through `herdr agent prompt <pane-id> <text> --wait --until working --until blocked`, which owns paste *and* submit and surfaces Herdr's own `agent_prompt_stalled`; (2) if that transport rejects or stalls, `herdr pane send-text` + Enter is used as a fallback; (3) anything larger is **refused** with an actionable warning (see Platform Limits below). Pane ids are preferred over agent names, which some Herdr builds reject (`agent target codex not found`).
  - **Hand-built command line**: the prompt is passed to `herdr` through a `ProcessStartInfo` argument string that quotes the text per `CommandLineToArgvW` rules (`ConvertTo-WindowsCommandLineArg`), not through PowerShell's native argument passing, which re-splits large multi-line prompts into stray options.
  - **Delivery confirmation**: after sending, dispatch polls for a `working`/`blocked` transition. The paste fallback keeps re-pressing Enter every 2.5s for up to ~45s, because a multi-KB paste can take tens of seconds to absorb before an Enter counts at all. An unconfirmed delivery is a hard failure (`exit 1`) rather than a success — otherwise the follow-up wait returns instantly and its report shows the worker's previous turn as this task's answer.
  - **Never clears a composer.** Dispatch does not send `ctrl+c` or `Escape` to a worker pane under any circumstance; on an unconfirmed delivery it warns and leaves clearing to the operator.
  - **Dynamic On-Demand Auto-Spawning**: If a requested worker (e.g. `kilo-scout`, `codex`, `opencode`) is not currently running in Herdr, `dispatch.ps1` automatically creates a new pane to the right (`herdr pane split --current --direction right --no-focus`), boots the agent (`herdr agent start <name> --kind <kind> --pane <id>`), awaits interactive readiness, and proceeds with dispatch.
  - `-Worker <name|pane_id> -Spec <path>`: Single worker dispatch.
  - `-Workers "w3:p5,codex" -Spec <path>`: Broadcast spec to multiple workers.
  - `-Target @{ "w3:p5" = "spec1.md"; cline = "spec2.md" }`: Parallel dispatch with distinct specs.
  - `-InstructionPrompt "<text>"`: Inline prompt body, used instead of the default "read <spec> and implement" prompt.
  - `-Wait`: Synchronously blocks until the worker completes its turn in Herdr.
  - `-TimeoutSeconds <sec>`: Maximum wait duration (default 300s).

- **`wait-agent.ps1`**:
  Monitors completion via Herdr's native lifecycle tracking.
  - `-Workers "w3:p5,codex,cline"`: Workers/panes to wait on.
  - `-Mode All` (default): Wakes up when **all** specified workers return to `idle` or `done`.
  - `-Mode Any`: Wakes up when **any** specified worker completes (first-responder).
  - Actively inspects `herdr agent list` during polling; alerts immediately if any worker transitions to `blocked` (waiting on human input/approval).
  - `-RequireActivity` (passed automatically by `dispatch.ps1 -Wait`): refuses to treat a never-observed-`working` agent's first stable `idle` as completion. A prompt that was pasted but never submitted leaves the agent idle forever, and accepting that as "finished" is how a stale turn reaches a report.

- **`get-report.ps1`**:
  **Primarily uses AgentsView** to extract the worker's structured assistant conclusion with explicit source attribution (`Source: AgentsView` vs `Source: Herdr Terminal Buffer`).
  - **Step 0 Auto-Sync**: Automatically runs an incremental `agentsview sync` (~500ms) before querying, ensuring all in-flight SQLite WAL frames and un-indexed JSONLs are ingested into the database. (Bypass with `-NoSync`).
  - Session resolution follows a strict 4-tier strategy:
    1. **Herdr Live Inventory**: Uses `agent_session.value` if the agent socket reports an active session ID (e.g. Kilo, Codex).
    2. **Targeted AgentsView Query**: Runs `agentsview session list --agent <agentName> --include-one-shot --limit 5 --json`, selecting the session matching the current workspace `cwd`.
    3. **Windowed AgentsView Query**: Scans recent sessions within the last 4 hours matching worker name.
    4. **Herdr Buffer Fallback**: Takes an 80-line terminal viewport snapshot only if AgentsView hasn't indexed the session.
  - `-Workers "codex,kilo-scout,cline"`: Resolves and formats reports side-by-side.
  - `-SinceIso <iso-utc>`: **Freshness bound** — only assistant turns whose timestamp is at or after this instant are reported, and the report is then exactly the newest such turn. Set it to a timestamp captured immediately before dispatch. Under a freshness bound the alternate-session search and the terminal-buffer fallback are both skipped (a viewport cannot be time-filtered), so a missing turn cannot be masked by older content.
  - `TERMINAL_ORCHESTRATOR_NO_NEW_TURN` in the output means no qualifying turn was indexed yet; the worker's previous turn is deliberately withheld. It retries the AgentsView sync ~4x (~4s) first, because a turn that just went idle may not be flushed to JSONL yet.
  - `-Limit <int>`: Max assistant turns to retrieve (default: 3; ignored when `-SinceIso` narrows the report to one turn).
  - `-NoSync`: Skips the initial incremental `agentsview sync` step.
  - `-OutputFile <path>`: Optionally saves combined markdown report.

- **`consult.ps1`**:
  High-level, agent-agnostic one-shot consultation command that packages the full round-trip workflow (spec preparation / git diff packaging -> dispatch with synchronous wait -> AgentsView structured report extraction).
  - `consult.ps1 <worker> [-Changes] [-Topic "<title>"]`: Automatically packages all current modifications (git status, staged diffs, and unstaged working tree diffs) into a structured review spec, injects the no-tools guard, dispatches it to `<worker>`, waits, and retrieves the verdict.
  - `consult.ps1 <worker> -StagedDiff [-Topic "<title>"]`: Packages specifically staged git diffs (`git diff --cached`).
  - `consult.ps1 <worker> <specPath>`: Run consultation against an existing specification markdown.
  - `consult.ps1 <worker> -Prompt "<question>"`: Quick consultation with an inline question, auto-generating a spec.
  - **Natural Language Triggers**:
    - **Review Changes**: When asked to *"check our current changes with <worker>"* or *"consult <worker>"*: simply run `consult.ps1 <worker> -Changes`. It automatically handles all context packaging, prompt sanitization, tool restriction, reactive socket wait, and report extraction.
    - **Plan Review / Second Opinion**: When asked to *"consult <worker> about our plan"* or *"get a second opinion on this implementation"*: save the prompt into `.orchestrator/specs/<topic>[-roundN].md` and run `consult-inline.ps1 <worker> .orchestrator/specs/<topic>.md -Topic "<title>"`. **Do not use `consult.ps1 <worker> <specPath>` for a no-tools review**: dispatch delivers only the *prompt text*, never the spec's contents, so a tool-less reviewer cannot read the staged file and will refuse (observed: "I couldn't read the plan under the constraints given"). `consult-inline.ps1` reads the prompt in-process and inlines it, so the reviewer needs no tools at all. The target agent receives the full prompt, reviews the architecture, and returns feedback in pure prose.
  - **Automatic Diff Size-Guard**: Diffs >150KB or >1500 lines automatically filter out lockfiles (`package-lock.json`, `pnpm-lock.yaml`), prepend `git diff --stat` (capped at 100 files), and truncate the diff body to the first 1,000 lines with an informative measurement notice. Use `-FullDiff` to bypass when the full raw diff is explicitly required.
  - **Freshness-bound verdicts**: consult records an ISO timestamp immediately before dispatch and passes it to `get-report.ps1 -SinceIso`, so the extracted verdict can only be a turn that completed after the dispatch. If the worker produces no such turn, consult warns that the consultation has **no verdict** instead of letting a previous turn stand in for it.
  - Fully agent-agnostic: `<worker>` can be `codex`, `kilo`, `cline`, `freebuff`, `opencode`, or any active pane ID (e.g. `w5:p2`).

- **`consult-inline.ps1`**:
  One-shot consultation whose prompt is **read from a file and inlined**, which is the supported way to run a no-tools review of a long prompt.
  - `consult-inline.ps1 <worker> <promptFile> [-Topic "<title>"] [-TimeoutSeconds <sec>] [-Limit <int>]`: reads the prompt with `Get-Content -Raw`, normalizes line endings, checks it against the inline delivery budget, then delegates to `consult.ps1 -InstructionPrompt`.
  - **Why the file indirection exists**: the text must never cross a shell argument boundary. Handing a long multi-line prompt to PowerShell as an argument re-splits it (observed: a 19KB prompt reaching Herdr as `unknown option: by`), so the read has to happen inside PowerShell. A small bespoke runner script per consultation is no longer needed -- that was the workaround this script replaces.
  - **Budget guard**: prompts above **20,000 chars** are refused up front with guidance (condense into rounds, or consult a self-contained spec with `-AllowTools`), and prompts within 10% of the budget warn. The dispatcher enforces the same limit independently.
  - `-AllowTools`: lets the worker read the staged file itself, for cases where the content genuinely cannot be inlined.

- **`clean.ps1`**:
  Wipes temporary specs and reports in `.orchestrator/`.
  - `-All`: Clears all temporary staging files.

---

## Platform Limits & Failure Modes (verified Sep 2026, Herdr on Windows)

These are observed constraints of the Herdr CLI + terminal agent TUIs. They explain why the scripts are shaped the way they are; do not "simplify" the delivery ladder without re-verifying them.

- **Inline text travels in argv.** `herdr agent prompt <target> <text>` and `herdr pane send-text <pane> <text>` both carry the payload as a command-line argument, so roughly 32K is a hard launch ceiling: a 35KB prompt dies with `ApplicationFailedException` / exit 2, and PowerShell's re-splitting of a large argument can even make Herdr misread it as options (`unknown option: by`). Hence the 20,000-char inline budget and the refusal above it.
- **Paste submission is a race. Prefer Herdr's prompt API.** A multi-KB bracketed paste can take tens of seconds to be absorbed by an agent TUI, and any Enter sent before that is silently swallowed: a 12KB paste sat as `[Pasted Content 12417 chars]` with the agent `idle` through eight Enter attempts spaced 700ms apart, and submitted only after a much later Enter. `herdr agent prompt` pastes *and* submits in one call, which is why it is the primary transport and the paste+Enter path is only a fallback.
- **A single paste per prompt.** A ~19KB paste is delivery-proven; splitting the same text across several `send-text` calls does **not** concatenate reliably in an agent TUI (the first paste registers, later ones are dropped or partially absorbed).
- **A pending paste blocks the composer.** While an unsubmitted paste sits in the input line, further input may be ignored — so a failed delivery must be cleared before the next dispatch.
- **NEVER clear a composer with `ctrl+c` or `Escape`.** In Codex CLI a single `ctrl+c` may clear the input, but a second press **exits the agent** (this killed a live Codex session during development), and a bare `Escape` means "edit previous message", silently re-opening the previous turn. Clearing a stuck composer is the operator's job.
- **Herdr writes failures to stderr while the exit code stays 0.** Capture stderr to a file and scan it for `"error"` / `agent_prompt_stalled` / `agent_blocked`; `2>&1` in PowerShell turns those lines into `ErrorRecord`s that abort the calling statement.
- **Target form matters.** Agent-scoped commands may reject agent names (`agent target codex not found`) while accepting pane ids (`herdr agent get w6:pB` works). Always keep a pane id in hand.
- **Keep `.ps1` sources ASCII-only.** Without a UTF-8 BOM PowerShell 5.1 reads scripts as ANSI, so a single non-ASCII byte (an em dash's `0x94`) decodes into a stray quote and produces cascading, misleading parse errors.

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

---

### 6. Architectural Consultation & Pre-Commit Review (One-Shot Consult Flow)
*Quickly solicit an expert peer review or sanity-check from any agent on staged diffs, architecture plans, or design questions.*

```powershell
# 1. Consult Codex (or any agent) on current staged changes before committing:
# (Auto-packages staged diff + status and instructs reviewer: "Do not read other files and do not use tools")
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/consult.ps1 codex -StagedDiff -Topic "Review Staged AI Hardening"

# 2. Consult on an existing specification markdown:
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/consult.ps1 codex .orchestrator/specs/consult-9-signoff.md

# 3. Quick consultation with an inline design question:
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/consult.ps1 opencode -Prompt "Compare SQLite CAS vs version increment for offline sync idempotency"

# 4. Peer review on an implementation or architectural plan:
# (Cline/User stages agreed plan to a spec; reviewer provides feedback in pure prose with zero tool calls)
powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/consult.ps1 codex .orchestrator/specs/feature-plan.md
```

---

### 7. Token-Saver Large-Diff Consultation (Scout Summarization + Specialist Review)
*Save 90–95% of tokens when using an expensive, high-reasoning model (e.g. Codex on GPT-5/o1, Claude 3.5 Sonnet) to review large changes.*

Instead of dumping a raw 30,000+ token diff into an expensive model:
1. **Local Scout (e.g. Cline or Kilo) reviews the raw diff locally**:
   - Compiles an **Architectural Review Dossier** into `.orchestrator/specs/<topic>-dossier.md`:
     - **Summary**: High-level purpose and architectural impact.
     - **Per-File Changes**: Key functions/classes modified and rationale.
     - **Critical Snippets**: Only the load-bearing interfaces, state changes, or algorithms.
     - **Targeted Questions**: Specific risks, concurrency edge cases, or trade-offs for the expert model.
2. **Dispatch the dense dossier to the expensive consultant**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/consult.ps1 codex .orchestrator/specs/<topic>-dossier.md
   ```
3. **Outcome**:
   The expensive model reads ~1,500–2,500 tokens of concentrated architectural signal instead of 40,000 tokens of raw diff, delivering superior architectural critique at a tiny fraction of the cost.

