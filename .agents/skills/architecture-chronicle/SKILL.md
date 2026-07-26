---
name: architecture-chronicle
description: Produce a comprehensive engineering chronicle for a completed implementation phase, capturing architectural decisions, data flows, repository patterns, migrations, and system evolution for future developer or AI handoffs.
---

# Architecture Chronicle Skill

The **Architecture Chronicle** skill performs a READ-ONLY architectural review of git changes and system state following an implementation phase. It produces a project-agnostic, long-term engineering document that captures **why** the system was built the way it was, how data flows through layers, what legacy architecture was removed, and whether the project is ready for subsequent phases.

---

## Purpose

Capture durable architectural knowledge so another engineer (or AI model in a future session) can immediately understand the architecture, data flow, migration strategies, and technical trade-offs without manually analyzing git diffs or reading entire source trees.

---

## Workflow

1. **Perform a Read-Only Git Audit**:
   - Run `git status` to identify modified, added, deleted, and staged files.
   - Run `git log -n 5` to inspect recent commit history.
   - Run `git diff --cached` or `git diff` to understand exact code changes.
   - **DO NOT** modify source code, stage commits, or run refactoring tools.

2. **Execute Build & Lint Verification**:
   - Run project verification commands (e.g. `npm run build`, `npm run lint`, `npm run preview`).
   - Confirm compilation status, lint warnings, and runtime preview behavior.

3. **Generate the Architecture Chronicle Report**:
   - Produce a clean, well-formatted Markdown chronicle.
   - Save the document to an artifact or output file (e.g. `walkthrough.md` or `chronicle.md`).

---

## Chronicle Report Structure

The generated chronicle report must contain the following 12 sections:

### 1. Executive Summary
- Overall phase completion status and percentage (0-100%).
- Key architectural wins and goals achieved.
- Any deviations from the original design plan and unexpected design improvements.

### 2. Files Changed Breakdown
Group files into **Added**, **Modified**, **Deleted**, and **Renamed / Moved**. For every file, document:
- Purpose of the file
- Reason for change / creation
- How it integrates into the system architecture

### 3. Component & Layer Architecture
- Describe key system layers (UI, Feature Hooks, State Management, Domain Ports, Infrastructure Adapters, Storage).
- Include an ASCII diagram showing how layers interact.

### 4. Core Domain & Data Resolution
- Explain entity models, value objects, domain interfaces, and resolution dispatches (e.g., storage-oriented `MaterialSourceType`).
- Explain how repository ports abstract underlying data sources.

### 5. Asset & Storage Organization
- Explain static directory organization (e.g. `public/materials/` or asset pipelines) vs application code (`src/`).
- Highlight why separating content/data from code chunks improves bundle size, portability, and scaling.

### 6. Migration Strategy
- Explain legacy data issues (e.g. storage key changes or legacy data structure rewrites).
- Detail one-time migration functions and legacy data cleanup strategies.
- Mark migration code with `// TODO(v1.0)` cleanup tags.

### 7. Error Handling & Guarding Strategy
- Document typed domain errors (e.g. `DocumentNotFoundError`).
- Explain UI error handling differentiation (friendly user notices vs unexpected error views).

### 8. End-to-End Data Flow
- Provide a step-by-step runtime trace from user interaction down to data fetching, preprocessor transformations, caching, and UI rendering.
- Include a sequential ASCII diagram.

### 9. Deprecated / Removed Architecture
- List all deleted files, removed in-memory registries, or obsolete patterns.
- Explain why removing each piece improves system health.

### 10. Verification & Quality Assurance
- Report build status (`npm run build`).
- Report lint status (`npm run lint`).
- Report preview / server verification.
- Document any remaining `TODO` items.

### 11. Full System Architecture Overview
- Summarize the complete system architecture after the phase.
- Map out the layer hierarchy from UI primitives to storage.

### 12. Final Assessment & Next Phase Readiness
- State whether the phase is 100% complete and production-ready.
- Note any technical debt.
- Confirm readiness for the next planned feature phase.

---

## Guidelines & Best Practices

- **Durable Knowledge**: Focus on architectural rationale and data flows, not just line-by-line diff summaries.
- **Portable & Reusable**: Avoid hardcoding project-specific assumptions into the skill rules so it works across any web, mobile, or backend repository.
- **Visual Diagrams**: Use simple ASCII diagrams for layer relationships and data flow sequences.
- **Read-Only Inspection**: Never alter source code or run destructive git operations during a chronicle review.
