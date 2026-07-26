# ADR-004 — Adopt Dexie.js IndexedDB as Primary Local Database Infrastructure

## Status
Accepted

## Introduced
Phase 5 — Assessment Engine Foundation

## Decision Drivers
- Need for high-capacity, indexed local document storage supporting questions, quizzes, sessions, flashcards, AI outputs, and search indexes.
- Overcoming `localStorage` limitations (5MB storage cap, synchronous main-thread blocking, string-only data format).
- Offline-first capabilities with structured schema versioning and atomic multi-store transactions.

## Context
Up to Phase 4, `localStorage` was acceptable for simple metadata. Phase 5 introduced question banks, quiz attempts, and answer history. Future phases (Flashcards, AI Content, Search Indexes) require structured querying (by material, difficulty, tags, or timestamps) that cannot be efficiently handled by synchronous string-based storage.

## Decision
We adopt **Dexie.js** to manage an IndexedDB database (`lunaclair-db`) in `src/infrastructure/database/`. We implement versioned schema object stores (`materials`, `questions`, `quizzes`, `quizSessions`, `highlights`, `drawings`, `preferences`, `metadata`) with indexed query fields.

## Alternatives Considered
- **localStorage Key-Value Storage**: Synchronous, blocks main thread, capped at 5MB, lacks indexing for queries.
- **Raw Browser IndexedDB API**: Native API is callback/event-based, highly verbose, and lacks clean promise/async-await wrappers.
- **PouchDB**: Heavy sync engine overhead not required for pure local database operations prior to cloud sync.

## Consequences
### Positive
- Asynchronous, non-blocking storage with virtually unlimited browser storage capacity.
- Strong TypeScript integration, clean async/await API, and indexed query performance.
- Seamless schema versioning (`db.version(x)`) and atomic multi-store transactions.
- Automatic startup data migration (`DatabaseMigrator`) transfers legacy `localStorage` data into IndexedDB.

### Negative / Trade-offs
- Small library dependency (`dexie`).

## Related ADRs
- [ADR-001](ADR-001-repository-pattern.md) — Decouple Domain Contracts from Persistence via Repository Pattern
- [ADR-006](ADR-006-immutable-quiz-history.md) — Immutable Quiz Session History via Embedded Question Snapshots
