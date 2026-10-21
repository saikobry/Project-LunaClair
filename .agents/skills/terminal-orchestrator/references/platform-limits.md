# Platform Limits & Transport Invariants

Empirical constraints for Herdr on Windows and terminal agent TUIs. Do not modify transport logic without re-verifying against these constraints.

---

## 1. Command-Line Quoting & Argument Ceiling
- Windows command lines pass arguments in `argv` through `CommandLineToArgvW` rules (`ConvertTo-WindowsCommandLineArg`).
- Single inline prompt ceiling is **20,000 characters**. Prompts exceeding this limit must be passed via a staged specification file read by the worker, never as raw inline arguments.

## 2. Bracketed Paste Submission
- Large pasted content can take several seconds to be absorbed by agent TUIs (Codex, OpenCode, Kilo).
- `dispatch.ps1` confirms delivery by verifying transition to `working` or `blocked` status, resubmitting Enter periodically if absorbed.
- Never send `ctrl+c` (two presses terminate Codex CLI) or bare `Escape` (re-opens previous message) to clear a composer. Leave composer clearing to the human operator if delivery confirmation fails.

## 3. Session Identification & Provider Namespaces
- Herdr agent label `agy` maps to AgentsView provider namespace `antigravity-cli`.
- Herdr live `agent_session` values may temporarily report child or nested subagent IDs. Explicit Task ID or pinned session IDs must be preferred over scanning live process state.
- External retrieval commands (`agentsview sync`, `agentsview session messages`) must execute under finite process timeouts to prevent deadlocks from hanging background daemons.
