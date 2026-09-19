# ADR-011 — Public Application Context, Composition Root Slices, and CQRS Read Model

## Status

Accepted

## Introduced

Phase 12 — Composition Root & Public Application Context Modernization

## Decision Drivers

- Establish a clear, unambiguous developer mental model: **Features consume domain capabilities; Bootstrap coordinates infrastructure.**
- Prevent the leaking of internal infrastructure namespaces (`context.infrastructure.repositories.*`) into feature-level UI and query hooks.
- Modularize the monolithic composition root (`createUseCases.ts`) into cohesive, domain-sliced factories aligned with the system's 8 core business boundaries.
- Provide a principled, semantic rule for when an operation belongs in a Domain Repository vs. an Application Use Case (avoiding dogmatic "wrap every 1-line query in a use case" boilerplate while protecting application state transitions).
- Preserve single-flight singleton instance references across React context without duplicating memory allocations.

## Context

During early project phases, the application context combined concrete Dexie repositories, domain services, network transports, and 40+ use cases into a single flattened object with backward-compatibility aliases (`context.repositories`, `context.libraryRepository`, `context.useCases.*`).

During the composition root modularization sweep:
1. `createInfrastructure()` was categorized into explicit namespaces: `repositories`, `services`, `transports`, `providers`, `importerRegistry`, `syncReconciler`.
2. `createUseCases()` was growing into a monolithic 250+ line procedure assembling 40+ classes with complex dependency injection graphs across 8 disparate business domains.
3. `ApplicationContextValue` was initially typed as `Application = { infrastructure, useCases }`, forcing query hooks to write `context.infrastructure.repositories.library.getMaterials()`.
4. Several UI surfaces exhibited "mixed reads" — imperatively calling repository mutations inside query effects (e.g. chat thread recovery) or bypassing TanStack Query in modals with manual `useEffect` + `useState` promise fetching.

This introduced cognitive friction: feature developers were forced to type the word `infrastructure` when performing simple domain data queries, and the monolithic composition root was becoming unwieldy.

## Decision

We establish the **Pragmatic CQRS, Domain Port & Composition Root Architecture**:

```text
                       FEATURE LAYER
                             │
            ┌────────────────┴────────────────┐
            │                                 │
     DATA ACCESS / LOOKUP            APPLICATION INTENT / ACTION
    (Pure reads & projections)      (State transitions & workflows)
            │                                 │
            ▼                                 ▼
       repositories                        useCases
            │                                 │
            └────────────────┬────────────────┘
                             ▼
                    infrastructure layer
```

1. **Public Application Context Contract (`Application`)**:
   The application container exposed via `ApplicationContext` is structured into three explicit properties:
   - `repositories`: Pure **Domain Port Interfaces** (`LibraryRepository`, `SubjectRepository`, `QuizRepository`, etc.) used directly by TanStack Query hooks for simple data lookups.
   - `useCases`: Application-level workflows, mutating commands, composite orchestration, and state transitions.
   - `infrastructure`: Concrete machinery (`db`, domain services, transports, reconcilers) preserved for shell-level bootstrap (e.g. auto-sync mounting) and internal wiring.

2. **Modular Domain Slice Factories for Use Cases**:
   Rather than maintaining a monolithic `createUseCases.ts`, the composition root is partitioned into 8 cohesive, domain-sliced factories in `src/app/bootstrap/use-cases/`:
   - `createQuizUseCases` (quiz sessions, canvas authoring, question lifecycle)
   - `createLibraryUseCases` (materials, subjects, terms, D1 catalog imports)
   - `createReaderUseCases` (annotations, highlights, drawings)
   - `createAnalyticsUseCases` (learning insights, global and subject mastery)
   - `createAiUseCases` (chat sessions, streaming token adapters, thread recovery)
   - `createImporterUseCases` (PDF/OCR extractors, AI cleanup, atomic commit)
   - `createSharingUseCases` (cloud publishing, package cloning, download tracking)
   - `createSyncUseCases` (SyncEngine, conflict resolution, status store)

   `createUseCases.ts` acts as the delegating orchestrator, delegating instantiation to these 8 slices while sharing singleton services (e.g. `sharing`, `importerRegistry`, `syncEngine`).

3. **Semantic Responsibility Rule for Repositories vs. Use Cases**:
   - **Data Access Lookups (`repositories`)**: If an operation is a simple 1:1 data fetch (`getById`, `getMaterials`, `getQuestions`, `getTerms`), features consume the Domain Repository port directly via TanStack Query without creating dummy 1-line use case wrapper classes.
   - **Application Capabilities & State Transitions (`useCases`)**: If an operation represents an intentional state transition (e.g., `publishQuestion`, `archiveQuiz`), multi-entity orchestration (`importMaterial`, `publishStudyPackage`), or domain computation (`recordFlashcardReview`, `startQuizSession`), it **must** remain an Application Use Case, even if its initial implementation is lightweight. Line count does not determine use case validity; semantic domain intent does.

4. **Self-Healing Domain Workflows & Reactive Query Hooks**:
   - Complexities like crash-recovery for interrupted AI chat messages are encapsulated inside `ResolveAiThreadUseCase` rather than invoked manually by UI hooks. (The decision is unchanged; the implementing use case was renamed when AI conversations became multi-session — see `src/application/AGENTS.md`.)
   - Modals and forms consume reactive TanStack Query hooks (e.g. `useTerms(subjectId)`) instead of invoking raw repository methods in `useEffect`.

5. **Zero Instance Duplication**:
   `Application.repositories` references the exact same singleton instances instantiated by `createInfrastructure()`. No wrapper proxies or secondary instance allocations occur.

## Alternatives Considered

- **Wrap Every Single Operation in a Use Case (Dogmatic Clean Architecture)**: Requires creating 20+ pass-through classes that do nothing except forward a method call to a repository. Rejected because TanStack Query already handles read caching, retry, and staleness, and pass-through classes add noise with zero domain value.
- **Expose Only `infrastructure` on Context**: Forces UI code to type `context.infrastructure.repositories.*`, creating cognitive dissonance and leaking infrastructure terminology into the presentation layer.
- **Monolithic `createUseCases` (Status Quo)**: Kept 40+ use cases in one 250+ line file. Rejected in favor of modular domain slices for maintainability and testability.

## Consequences

### Positive

- **Clean Developer Ergonomics**: Query hooks read naturally (`context.repositories.library.getMaterials()`), while mutations communicate clear intent (`context.useCases.library.createMaterial.execute(...)`).
- **Domain Slice Maintainability**: Adding or modifying a use case in a specific domain only touches its slice factory (`bootstrap/use-cases/create<Domain>UseCases.ts`).
- **Domain Independence**: Features are typed against abstract Domain Port interfaces (`src/domain/`), completely isolated from concrete `Dexie*` or `Worker*` infrastructure classes.
- **Static Boundary Protection**: `src/features/**` remains statically prohibited by Oxlint from importing anything from `src/infrastructure/**`.
- **Zero Overhead**: Zero duplicate object allocations.

### Negative / Trade-offs

- Developers must exercise semantic judgment when deciding between calling a repository read method or authoring an application use case.

## Related ADRs

- [ADR-001](ADR-001-repository-pattern.md) — Decouple Domain Contracts from Persistence via Repository Pattern
- [ADR-002](ADR-002-react-context-di.md) — Dependency Injection via React Context
- [ADR-003](ADR-003-tanstack-query.md) — Async Data Caching & Synchronization via TanStack Query
- [ADR-010](ADR-010-replace-barrel-based-feature-boundaries.md) — Replace Barrel-Based Feature Boundaries
