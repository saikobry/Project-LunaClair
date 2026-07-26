# ADR-007 — Feature-First Project Module Organization

## Status
Accepted

## Introduced
Phase 1 — Core Architecture & Layout Setup

## Decision Drivers
- Co-locating related components, hooks, queries, types, and styles within feature boundaries.
- Preventing cross-feature tight coupling and circular dependencies.
- Facilitating clear code ownership, scaling feature teams, and modular code isolation.

## Context
Traditional Layer-First folder structures (e.g. `components/`, `hooks/`, `containers/`, `pages/` at root) group unrelated domain concerns together. As applications grow, features become scattered across dozens of directories, making navigation, refactoring, and code deletion difficult.

## Decision
We organize application source code by **Feature Modules** (`src/features/reader/`, `src/features/library/`, `src/features/quiz/`, etc.). Each feature module encapsulates its own components, hooks, queries, styles, and types. Features are strictly isolated: **features never import from other features**. Shared utilities live in `src/shared/`, domain models in `src/domain/`, infrastructure in `src/infrastructure/`, and application shell in `src/app/`.

## Alternatives Considered
- **Layer-First Architecture (`components/`, `hooks/`, `views/` at root)**: Poor co-location; causes scattered files when maintaining a single feature.
- **Micro-Frontends**: Excessive build and runtime overhead for a client-side application.

## Consequences
### Positive
- High cohesion: Everything for a feature lives in one directory.
- Clear import rules prevent circular dependencies and cross-feature coupling.
- Easy to add, modify, or remove feature modules safely.

### Negative / Trade-offs
- Code needed by multiple features must be consciously extracted into `src/shared/` or `src/domain/`.

## Related ADRs
- [ADR-001](ADR-001-repository-pattern.md) — Decouple Domain Contracts from Persistence via Repository Pattern
- [ADR-005](ADR-005-strategy-pattern.md) — Strategy Pattern for Question Validation & Grading
