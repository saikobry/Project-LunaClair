# ADR-002 — Dependency Injection via React Context (`RepositoryProvider`)

## Status
Accepted

## Introduced
Phase 2 — Study Library Foundation

## Decision Drivers
- Avoiding direct imports of concrete singleton classes inside React components or hooks.
- Facilitating easy swapping of repository implementations per environment or feature flag.
- Enforcing architectural import boundaries across feature modules.

## Context
Even with domain repository interfaces (ADR-001), React components need a clean runtime mechanism to access concrete repository instances without directly importing infrastructure classes (e.g. `import { dexieQuestionRepository } from '...'`).

## Decision
We supply singleton repository instances to the React component tree via `<RepositoryProvider>` using React Context (`RepositoryContext`). Feature modules access repositories through dedicated dependency injection hooks (`useLibraryRepository()`, `useQuestionRepository()`, etc.).

## Alternatives Considered
- **Direct Singleton Module Imports**: Component modules import storage singletons directly. Simple, but breaks architectural import boundaries and hampers testing.
- **Heavy DI Framework (e.g. InversifyJS)**: Adds unnecessary bundle size, complexity, and non-idiomatic React patterns.

## Consequences
### Positive
- Component hierarchy remains clean and decoupled from concrete classes.
- Swapping storage backends across the app requires updating only `<RepositoryProvider>`.
- Enables straightforward provider mocking for UI component testing.

### Negative / Trade-offs
- Features require React Context availability to access repositories.

## Related ADRs
- [ADR-001](ADR-001-repository-pattern.md) — Decouple Domain Contracts from Persistence via Repository Pattern
- [ADR-003](ADR-003-tanstack-query.md) — Async Data Caching & Synchronization via TanStack Query
