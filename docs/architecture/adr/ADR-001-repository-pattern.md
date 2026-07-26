# ADR-001 — Decouple Domain Contracts from Persistence via Repository Pattern

## Status
Accepted

## Introduced
Phase 2 — Study Library Foundation

## Decision Drivers
- Decoupling business logic from storage mechanisms.
- Preparing LunaClair for multi-stage storage evolution (localStorage → IndexedDB → Firebase / Cloud Sync).
- Testability and domain isolation.
- Asynchronous data access standardization.

## Context
In early phases, UI components risked importing browser-specific storage calls directly. As LunaClair evolves from a basic document viewer into a full assessment platform with cloud synchronization, hardcoding storage access inside features would lead to widespread refactoring whenever storage backends change.

## Decision
We establish asynchronous **Repository Interfaces (Ports)** in `src/domain/` for every domain entity aggregate (`LibraryRepository`, `DocumentRepository`, `AnnotationRepository`, `QuestionRepository`, `QuizRepository`, `QuizSessionRepository`). Domain and feature modules depend strictly on these interfaces. Concrete storage implementations (Adapters) reside in infrastructure/service layers.

## Alternatives Considered
- **Direct LocalStorage / IndexedDB Calls inside Hooks**: Simple to write initially, but creates severe coupling and requires refactoring every feature when changing storage engines.
- **Active Record Pattern (Models manage their own I/O)**: Violates domain purity rules and pollutes domain entities with persistence code.

## Consequences
### Positive
- Feature components remain 100% agnostic of how or where data is stored.
- Storage backends can evolve (e.g. from LocalStorage to Dexie IndexedDB to Firebase) without changing a single line of feature or UI code.
- Domain logic can be unit tested without browser storage mocks.

### Negative / Trade-offs
- Requires maintaining repository interface files and separate infrastructure implementations.

## Related ADRs
- [ADR-002](ADR-002-react-context-di.md) — Dependency Injection via React Context
- [ADR-004](ADR-004-dexie-indexeddb.md) — Adopt Dexie.js IndexedDB as Primary Local Database Infrastructure
