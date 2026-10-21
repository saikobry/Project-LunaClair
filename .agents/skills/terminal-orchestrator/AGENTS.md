# Terminal Orchestrator

## Purpose

Coordinating interactive terminal AI agents (Codex, Kilo, Cline, OpenCode, Antigravity CLI) running inside Herdr on Windows with explicit task callbacks and structured reports.

## Ownership

- `SKILL.md`: Main orchestrator skill definition and progressive disclosure router.
- `scripts/dispatch.ps1`: Task dispatcher with delivery confirmation, parameter validation, and task registration.
- `scripts/complete-task.ps1`: Explicit worker completion helper with parent callback notification.
- `scripts/get-report.ps1`: Structured report retrieval by task ID or session ID via AgentsView.
- `scripts/wait-agent.ps1`: Diagnostic socket-level lifecycle waiting.
- `scripts/consult.ps1`: Automated packaging and consultation for git diffs.
- `scripts/consult-inline.ps1`: Inlined file prompt consultation avoiding Windows argument splitting.
- `scripts/clean.ps1`: Ephemeral staging cleaner for `.orchestrator/`.
- `tests/run-validation.ps1`: Regression test suite for orchestrator scripts and contract invariants.
- `references/topologies.md`: Multi-worker collaboration patterns (Pair Programmer, Sequential, Parallel, Council, Scout).
- `references/platform-limits.md`: Windows command-line quoting and Herdr transport invariants.

## Local Contracts

- **Delegation Policy.** Governed by root [AGENTS.md](../../../AGENTS.md) (`User Preferences`): parent yields turn immediately upon dispatch and wakes only on explicit completion callback; local mechanics route through `dispatch.ps1` and `complete-task.ps1`.
- **Completion Evidence & Digest Verification.** Completed status requires a pre-registered task, non-empty regular report artifact, and verified SHA-256 digest (`reportHash`). Missing metadata or altered bytes reject completion and retrieval.
- **Notification State Machine & Atomic Persistence.** Atomically tracks `pending`, `in_flight`, `delivered`, `delivery_failed`, `unnotified`, and `no_return_pane`. Exactly one notification attempt is claimed under lock; retries require explicit operator `-Force`. `Write-AtomicJsonFile` uses Win32 `ReplaceFileW` with zero `Move-Item` fallback, preserving the last valid file on error without weakening atomicity.
- **Workspace Root Identity.** Paths and tasks resolve relative to an explicit or auto-discovered workspace root (`-WorkspaceRoot`), persisting `workspaceRoot` in task records to ensure uniform resolution from subdirectories.
- **Transcript Mode vs Task Evidence.** Retrieval via `get-report.ps1` distinguishes completed task evidence (`-TaskId`) from unverified transcript evidence (`-Workers`, `-SessionId`). Heuristic transcript retrieval queries `agentsview session get <id> --json`; absence of `parent_session_id` does not prove main correspondence, so ambiguous lookups fail closed (`SESSION_CORRESPONDENCE_UNVERIFIED`). Explicit transcript extraction requires a pinned main `-SessionId` (supported via `consult.ps1 -SessionId`).
- **Bounded External Retrieval.** External commands run with finite process timeouts and bounded stream drains (`[Task]::WaitAll`), returning retrieval errors rather than hanging on child-inherited pipe handles.
- **Provider Namespace Alignment.** The Herdr agent label `agy` maps to the AgentsView provider namespace `antigravity-cli`.
- **Flash Delegation Profile (`agy`).** When coordinating `agy` using a Flash model, delegate roughly ~80% of suitable substantive research and implementation to native `self` subagents (`TypeName: "self"`, `Model: "inherit"`). Purpose: keep the Flash coordinator's context lean, avoiding accumulation of exhaustive research, file contents, and debugging churn (lower token cost is the user's observed preference and working hypothesis, not a universal guarantee).
- **Early Delegation & Execution Sequence.** For nontrivial tasks, the coordinator reads applicable contracts, conducts minimal scoping to set boundaries, and launches the `self` subagent early; do not pre-investigate the entire solution before delegating. Subagents do not recursively spawn child agents by default. Parallelize independent scopes with disjoint, non-overlapping file ownership, or sequence dependent edits across successive workers.
- **Coordinator and Worker Role Boundaries.** The coordinator owns decomposition, briefing, integration decisions, verification of evidence/diffs, and final synthesis. Workers execute task discovery, edits, and verification, returning concise summaries (changed paths, rationale, checks run, unresolved issues) with concise evidence by default and targeted excerpts only when review requires them.
- **Direct Execution Exception.** The coordinator may directly execute genuinely tiny edits, quick factual lookups, coordination/review, or work that cannot be usefully partitioned; direct execution exceptions stay small and brief.
- **Hands-Off Execution.** Both parent-to-worker and coordinator-to-subagent workflows follow root [AGENTS.md](../../../AGENTS.md) (`User Preferences`): yield turns and wake on native completion notifications without status polling loops or timers.

## Work Guidance

- Keep `.ps1` script sources ASCII-only to prevent encoding mismatches on Windows PowerShell 5.1.
- Prompts exceeding the inline delivery budget must be stored in a spec file under `.orchestrator/specs/` instead of passed inline.
- Never clear worker composers with `ctrl+c` or `Escape`.
- Under the Flash delegation profile, supply precise briefs with explicit file scopes, task-specific verification commands, and instructions to return concise summaries.

## Verification

- Parse PowerShell scripts for syntax errors via `[System.Management.Automation.Language.Parser]::ParseFile`.
- Validate skill frontmatter and instructions via `quick_validate.py`.
- Run regression test harness via `powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/tests/run-validation.ps1`.

## Child DOX Index

(No child DOX documents under this scope)
