# src/infrastructure/ — Persistence Layer

## Purpose

Dexie/IndexedDB database layer: schema definition, database lifecycle (open, migrate, seed), and concrete repository implementations satisfying domain contracts.

## Ownership

- `database/schema.ts` — Version 1/2/3 Dexie schemas (v3 adds `subjectTerms` composite key `[subjectId+termId], subjectId, termId`, strips `subjectId` and `order` from `terms`)
- `database/LunaClairDatabase.ts` — `Dexie` subclass with typed `Table` properties. Singleton `db`. v3 upgrade migration reads legacy `terms` (with `subjectId`/`order`), bulk-inserts `subjectTerms` rows, and strips `subjectId`/`order` from `terms` records.
- `database/DatabaseMigrator.ts` — One-time migration of legacy `localStorage` data (materials, highlights, drawings) into IndexedDB. Writes `databaseVersion`, `lastMigration`, `createdAt` metadata. v3 migration is handled natively by Dexie `version(3).upgrade()`.
- `database/DatabaseSeeder.ts` — Seeds demo subjects, global terms, subject-term links, categorized/uncategorized materials, 5 sample questions (one per type), and starter quizzes if database is empty.
- `database/DatabaseInitializer.ts` — Startup orchestrator: `db.open()` → `migrateIfNeeded()` → `seedIfEmpty()`.
- `database/repositories/` — Concrete repository implementations. `DexieLibraryRepository` performs raw material persistence; material association validation belongs to application use cases.
  - `DexieQuestionRepository` → `QuestionRepository`
  - `DexieQuizRepository` → `QuizRepository`
  - `DexieQuizSessionRepository` → `QuizSessionRepository` (multi-store transactions for immutable `questionSnapshots`)
  - `DexieLibraryRepository` → `LibraryRepository`
  - `DexieAnnotationRepository` → `AnnotationRepository`
  - `DexieSubjectRepository` → `SubjectRepository` (cascade: removes `subjectTerms` rows and clears `subjectId`/`termId` on `materials` on delete)
  - `DexieTermRepository` → `TermRepository` (cascade: removes `subjectTerms` rows and clears `termId` on `materials` on delete)
  - `DexieSubjectTermRepository` → `SubjectTermRepository` (manages many-to-many Subject ↔ Term associations with composite key `[subjectId+termId]`)
- `database/services/` — Concrete application service implementations:
  - `DexieTermService` → `TermService` (atomic `createAndAssignTerm` across `terms` + `subjectTerms` stores)
- `database/index.ts` — Barrel re-export of database core, startup services, schema versions, and repository singletons

## Local Contracts

- Imports from `domain/` (contract interfaces, model types) and `shared/` (annotation types, storage keys) — never from features.
- All repositories are exported as module-level singletons (e.g., `dexieQuestionRepository`).
- `DexieQuizSessionRepository.createSession()` uses `db.transaction('rw', ...)` across `quizSessions`, `quizzes`, and `questions` stores to atomically capture immutable `questionSnapshots`.
- Schema versioning: v1 (Phase 5), v2 (Phase 5.3 — subjects/terms), v3 (SubjectTerm junction — terms become global).
- Database name: `lunaclair-db`.
- Migration is idempotent — guarded by localStorage flags for v1/v2, native Dexie upgrade for v3.
- Seeding is idempotent — skipped if `materials` store is non-empty.
- `DexieSubjectTermRepository.addTerm()` validates subject and term existence, prevents duplicate associations, and auto-computes `max(order) + 1`.
- `DexieTermService.createAndAssignTerm()` runs a single `db.transaction('rw', [terms, subjectTerms, subjects])` that creates the global `Term`, validates the subject, and inserts the `SubjectTerm` junction with `max(order) + 1` — the operation is atomic.
- `DexieSubjectTermRepository.syncTerms()` validates all term IDs exist, input uniqueness, and atomically replaces the complete association set.
- `DexieLibraryRepository.createMaterial()` and `updateMaterial()` validate that if `termId` is set, the `(subjectId, termId)` junction record exists.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — `database/repositories/` is a flat directory of repository implementations and `database/services/` holds application service implementations.
