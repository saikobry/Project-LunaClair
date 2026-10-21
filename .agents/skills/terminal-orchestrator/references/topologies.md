# Multi-Worker Topologies

Optional multi-worker collaboration patterns inside Herdr. Read this reference only when designing multi-agent delegation pipelines.

---

## 1. Lead Architect + Pair Programmer (Token-Saver Pairing)
*High-reasoning model designs changes; fast/free model executes tools, file edits, and tests.*

1. **Lead Architect stages specification**:
   - Write `.orchestrator/specs/step1.md` with explicit paths, interfaces, and verification commands.
2. **Dispatch to Pair Programmer with callback**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker kilo-scout -Spec .orchestrator/specs/step1.md -ReturnPane w6:p12 -Report .orchestrator/reports/step1-report.md
   ```
3. **Yield and wait for completion callback**:
   - Architect yields turn. Worker completes edits, verifies, and runs `complete-task.ps1`.
   - Architect wakes on callback and reviews `.orchestrator/reports/step1-report.md`.

---

## 2. Builder + Reviewer (Sequential Pipeline)
*Worker 1 builds implementation; Worker 2 independently audits edge cases and quality.*

1. **Dispatch build task**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker opencode -Spec .orchestrator/specs/build.md -ReturnPane w6:p12 -Report .orchestrator/reports/build-report.md
   ```
2. **Upon completion callback, dispatch review task**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker codex -Spec .orchestrator/specs/review.md -ReturnPane w6:p12 -Report .orchestrator/reports/review-report.md
   ```

---

## 3. Divide & Conquer (Parallel Execution)
*Split work into decoupled domains (e.g. backend vs frontend) and dispatch concurrently.*

1. **Stage distinct specifications**:
   - `.orchestrator/specs/backend.md`
   - `.orchestrator/specs/frontend.md`
2. **Dispatch each worker with its own task ID and return pane**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker w3:p4 -Spec .orchestrator/specs/backend.md -TaskId backend-task -ReturnPane w6:p12 -Report .orchestrator/reports/backend.md
   powershell -ExecutionPolicy Bypass -File .agents/skills/terminal-orchestrator/scripts/dispatch.ps1 -Worker w4:p7 -Spec .orchestrator/specs/frontend.md -TaskId frontend-task -ReturnPane w6:p12 -Report .orchestrator/reports/frontend.md
   ```
3. **Yield and handle callbacks as they arrive**.

---

## 4. Scout & Specialist (Token-Saver Context & Peer Verdict)
*Worker 1 reads raw files/ASTs, distilling findings into a concise markdown dossier. Worker 2 acts as expert peer evaluating the dossier.*

1. **Dispatch Scout**:
   - Instruct Scout to write `.orchestrator/specs/<feature>-dossier.md` summarizing architecture and findings.
2. **Dispatch Specialist on the Dossier**:
   - Instruct Specialist to review the condensed dossier without reading raw repository trees.

---

## 5. Council / Dual-Perspective (Cross-Validation)
*Broadcast an architectural problem to multiple models to compare alternatives before implementation.*

1. **Dispatch identical spec to candidate workers** using distinct task IDs.
2. **Collect reports and compare trade-offs**.
