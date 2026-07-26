# Architecture Decision Records (ADRs)

This directory contains durable Architecture Decision Records (ADRs) for Project LunaClair. Each record documents a significant architectural decision, including its context, decision drivers, chosen approach, alternatives considered, and consequences.

---

## Immutability Rule

> **Accepted ADRs are immutable.**  
> Do not rewrite an existing accepted ADR when architecture evolves. If a decision changes, create a new ADR that references and supersedes the previous decision.

---

## Status Table

| ADR | Title | Status | Introduced |
| :--- | :--- | :--- | :--- |
| [ADR-001](ADR-001-repository-pattern.md) | Decouple Domain Contracts from Persistence via Repository Pattern | Accepted | Phase 2 |
| [ADR-002](ADR-002-react-context-di.md) | Dependency Injection via React Context (`RepositoryProvider`) | Accepted | Phase 2 |
| [ADR-003](ADR-003-tanstack-query.md) | Async Data Caching & Synchronization via TanStack Query | Accepted | Phase 3 |
| [ADR-004](ADR-004-dexie-indexeddb.md) | Adopt Dexie.js IndexedDB as Primary Local Database Infrastructure | Accepted | Phase 5 |
| [ADR-005](ADR-005-strategy-pattern.md) | Strategy Pattern for Question Validation & Grading | Accepted | Phase 5 |
| [ADR-006](ADR-006-immutable-quiz-history.md) | Immutable Quiz Session History via Embedded Question Snapshots | Accepted | Phase 5 |
| [ADR-007](ADR-007-feature-first-architecture.md) | Feature-First Project Module Organization | Accepted | Phase 1 |

---

## Standard ADR Template

```markdown
# ADR-XXX — [Title]

## Status
[Accepted | Proposed | Deprecated | Superseded by ADR-YYY]

## Introduced
Phase X — [Phase Name]

## Decision Drivers
- [Driver 1]
- [Driver 2]

## Context
[What problem were we trying to solve? What technical or user constraints existed?]

## Decision
[What option did we choose? Describe the core architectural principle.]

## Alternatives Considered
- [Alternative 1]: [Why it was rejected]
- [Alternative 2]: [Why it was rejected]

## Consequences
### Positive
- [Benefit 1]
- [Benefit 2]

### Negative / Trade-offs
- [Trade-off 1]

## Related ADRs
- [ADR-AAA](ADR-AAA.md)
```
