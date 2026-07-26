# ADR-003 — Async Data Caching & Synchronization via TanStack Query

## Status
Accepted

## Introduced
Phase 3 — Reader Feature Modernization & Caching

## Decision Drivers
- Standardizing async data fetching, caching, loading/error states, and background refetching.
- Eliminating manual `useEffect` data fetching and state synchronization boilerplate across features.
- Managing mutation lifecycles and query invalidations cleanly.

## Context
As LunaClair expanded from reading static materials to managing annotation highlights, drawings, and dynamic quizzes, manual state synchronization inside React components created race conditions and duplicated loading/error handling.

## Decision
We adopt **TanStack Query (`@tanstack/react-query`)** as LunaClair's data synchronization and caching layer. Feature modules define query key factories (e.g. `libraryQueryKeys`, `readerQueryKeys`, `assessmentQueryKeys`) and separate read query hooks (`useQuestions`) from mutation hooks (`useQuestionMutations`).

## Alternatives Considered
- **Custom React `useState` + `useEffect` Hooks**: Error-prone, lacks automatic background refetching, deduplication, and cache invalidation.
- **Redux Toolkit / RTK Query**: Excessive boilerplate and global store complexity for asynchronous server/storage data caching.

## Consequences
### Positive
- Declarative data fetching with standard `data`, `isLoading`, and `isError` returns.
- Automatic cache invalidation upon mutations ensures UI components stay synchronized.
- Feature components contain zero imperative async fetching loops.

### Negative / Trade-offs
- Adds `@tanstack/react-query` runtime dependency (~12kB gzipped).

## Related ADRs
- [ADR-001](ADR-001-repository-pattern.md) — Decouple Domain Contracts from Persistence via Repository Pattern
- [ADR-002](ADR-002-react-context-di.md) — Dependency Injection via React Context
