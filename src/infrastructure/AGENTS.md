# src/infrastructure/ — Persistence Layer

## Purpose

Dexie/IndexedDB database layer: schema definition, database lifecycle (open, migrate, seed), and concrete repository implementations satisfying domain contracts.

## Ownership

- `database/schema.ts` — Version 1 Dexie schema (8 object stores: `materials`, `questions`, `quizzes`, `quizSessions`, `highlights`, `drawings`, `preferences`, `metadata`)
- `database/LunaClairDatabase.ts` — `Dexie` subclass with typed `Table` properties. Singleton `db`.
- `database/DatabaseMigrator.ts` — One-time migration of legacy `localStorage` data (materials, highlights, drawings) into IndexedDB. Writes `databaseVersion`, `lastMigration`, `createdAt` metadata.
- `database/DatabaseSeeder.ts` — Seeds demo material, 5 sample questions (one per type), and a starter quiz if database is empty.
- `database/DatabaseInitializer.ts` — Startup orchestrator: `db.open()` → `migrateIfNeeded()` → `seedIfEmpty()`.
- `database/repositories/` — Concrete repository implementations:
  - `DexieQuestionRepository` → `QuestionRepository`
  - `DexieQuizRepository` → `QuizRepository`
  - `DexieQuizSessionRepository` → `QuizSessionRepository` (multi-store transactions for immutable `questionSnapshots`)
  - `DexieLibraryRepository` → `LibraryRepository`
  - `DexieAnnotationRepository` → `AnnotationRepository`
- `database/index.ts` — Barrel re-export of database core, startup services, and repository singletons

## Local Contracts

- Imports from `domain/` (contract interfaces, model types) and `shared/` (annotation types, storage keys) — never from features.
- All repositories are exported as module-level singletons (e.g., `dexieQuestionRepository`).
- `DexieQuizSessionRepository.createSession()` uses `db.transaction('rw', ...)` across `quizSessions`, `quizzes`, and `questions` stores to atomically capture immutable `questionSnapshots`.
- Schema versioning: v1 contains only Phase 5 stores. Future stores added via `version(2)`, `version(3)`, etc.
- Database name: `lunaclair-db`.
- Migration is idempotent — guarded by `lunaclair.migration.v1.complete` localStorage flag.
- Seeding is idempotent — skipped if `materials` store is non-empty.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — `database/repositories/` is a flat directory of repository implementations.
