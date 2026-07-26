# ADR-005 — Strategy Pattern for Question Validation & Grading

## Status
Accepted

## Introduced
Phase 5 — Assessment Engine Foundation

## Decision Drivers
- Supporting multiple question types (`multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`) without monolithic `switch`/`if` branching.
- Keeping domain assessment logic pure, extensible, and independently testable.
- Decoupling behavioral grading from UI rendering.

## Context
LunaClair requires a flexible assessment engine capable of supporting diverse question formats now and in future phases (e.g. Matching, Ordering, Code Completion). Embedding validation and grading logic inside React components or monolithic functions leads to fragile code that violates the Open/Closed Principle.

## Decision
We adopt the **Strategy Pattern** for assessment domain behavior. Each `QuestionType` is governed by a dedicated `QuestionStrategy` (`MultipleChoiceStrategy`, `MultipleSelectStrategy`, `TrueFalseStrategy`, `IdentificationStrategy`, `FillBlankStrategy`) resolved via `QuestionStrategyResolver`. A pure `AssessmentService` coordinates grading and returns deterministic evaluation scores without persistence side effects.

## Alternatives Considered
- **Monolithic `switch` statements inside AssessmentService**: Simple initially, but violates Open/Closed Principle and becomes unmaintainable as question types proliferate.
- **Embedding Strategy Logic inside UI Components**: Pollutes UI views with business logic and prevents testing assessment behavior independently of React rendering.

## Consequences
### Positive
- Adding a new question type requires creating a new strategy implementation without touching existing strategy code.
- Domain assessment behavior is 100% pure TypeScript logic, testable without React rendering or DOM setup.
- UI rendering remains cleanly separate using React component composition (`QuestionRenderer`).

### Negative / Trade-offs
- Requires creating separate strategy classes/objects for each question type.

## Related ADRs
- [ADR-006](ADR-006-immutable-quiz-history.md) — Immutable Quiz Session History via Embedded Question Snapshots
- [ADR-007](ADR-007-feature-first-architecture.md) — Feature-First Project Module Organization
