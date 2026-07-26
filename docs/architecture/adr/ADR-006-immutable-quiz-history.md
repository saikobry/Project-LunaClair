# ADR-006 — Immutable Quiz Session History via Embedded Question Snapshots

## Status
Accepted

## Introduced
Phase 5 — Assessment Engine Foundation

## Decision Drivers
- Guaranteeing historical accuracy and immutability for user quiz attempts.
- Preventing question bank updates, edits, or deletions from mutating historical user scores or question review logs.
- Ensuring historical review views reflect the exact question text and choices presented during the attempt.

## Context
In learning platforms, questions in a material's question bank undergo updates over time (fixing typos, updating choices, rephrasing prompts). If a `QuizSession` only stores question ID references, subsequent question bank edits alter historical quiz attempts, corrupting past session scores and analytics.

## Decision
We embed complete `questionSnapshots` inside each `QuizSession` record at the moment the session is created. Historical grading, score recalculation, and session reviews operate exclusively on `questionSnapshots`.

## Alternatives Considered
- **Foreign Key Question IDs only**: Storing only `questionId` array in session. Fails when questions are edited or deleted later, leading to broken historical data.
- **Copying Questions into a separate `HistoricalQuestions` table**: Adds database table complexity without providing benefit over embedded JSON snapshots.

## Consequences
### Positive
- Quiz session history and scores are 100% immutable and audit-proof.
- Deleting or editing a question in the main bank has zero impact on completed quiz attempts.
- Simplifies offline evaluation and historical session rendering.

### Negative / Trade-offs
- Slightly increases storage footprint per session attempt (mitigated by IndexedDB capacity).

## Related ADRs
- [ADR-004](ADR-004-dexie-indexeddb.md) — Adopt Dexie.js IndexedDB as Primary Local Database Infrastructure
- [ADR-005](ADR-005-strategy-pattern.md) — Strategy Pattern for Question Validation & Grading
