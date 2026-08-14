# src/infrastructure/ — Persistence Layer

## Purpose

Dexie/IndexedDB database layer: schema definition, database lifecycle (open, migrate, seed), and concrete repository implementations satisfying domain contracts.

## Ownership

- `database/schema.ts` — Version 1/2/3/4/5 Dexie schemas (v3 adds `subjectTerms` composite key `[subjectId+termId], subjectId, termId`, strips `subjectId` and `order` from `terms`; v4 adds `quizEditingDrafts` `'draftId, quizId, materialId, updatedAt'` for quiz canvas crash recovery; v5 adds `flashcardReviews` `'key, materialId, dueAt, lastReviewedAt'` for spaced-repetition state)
- `database/LunaClairDatabase.ts` — `Dexie` subclass with typed `Table` properties. Singleton `db`. v3 upgrade migration reads legacy `terms` (with `subjectId`/`order`), bulk-inserts `subjectTerms` rows, and strips `subjectId`/`order` from `terms` records. v4 adds `quizEditingDrafts`. v5 adds `flashcardReviews`.
- `database/DatabaseMigrator.ts` — One-time migration of legacy `localStorage` data (materials, highlights, drawings) into IndexedDB. Writes `databaseVersion`, `lastMigration`, `createdAt` metadata. v3 schema migration is handled natively by Dexie `version(3).upgrade()`; the v3 data pass (`lunaclair.migration.v3.complete`) normalizes stored question tags via domain `normalizeTags` (strip `#`, dedup case-insensitively, preserve first-seen casing).
- `database/DatabaseSeeder.ts` — Seed-once hydration: fetches the starter catalog (subjects, terms, subject-term links, materials) from `GET /api/catalog` (D1 snapshot) and bulk-writes into Dexie if empty; seeds 5 sample questions (one per type) and starter quizzes locally (quiz content still bundled). Skips seeding entirely when the catalog fetch fails (e.g. fresh offline boot) — the next boot retries.
- `database/DatabaseInitializer.ts` — Startup orchestrator: `db.open()` → `migrateIfNeeded()` → `seedIfEmpty()`.
- `database/repositories/` — Concrete repository implementations. `DexieLibraryRepository` performs raw material persistence; material association validation belongs to application use cases.
  - `DexieQuestionRepository` → `QuestionRepository` (normalizes `tags` through domain `normalizeTags` on create/update)
  - `DexieQuizRepository` → `QuizRepository`
  - `DexieQuizSessionRepository` → `QuizSessionRepository` (multi-store transactions for immutable `questionSnapshots`)
  - `DexieLibraryRepository` → `LibraryRepository`
  - `DexieAnnotationRepository` → `AnnotationRepository`
  - `DexieSubjectRepository` → `SubjectRepository` (cascade: removes `subjectTerms` rows and clears `subjectId`/`termId` on `materials` on delete)
  - `DexieTermRepository` → `TermRepository` (cascade: removes `subjectTerms` rows and clears `termId` on `materials` on delete)
  - `DexieSubjectTermRepository` → `SubjectTermRepository` (manages many-to-many Subject ↔ Term associations with composite key `[subjectId+termId]`)
  - `DexieQuizDraftRepository` → application `QuizDraftRepository` (crash-recovery drafts in `quizEditingDrafts`; latest-draft lookups by quiz or material)
  - `DexieFlashcardReviewRepository` → `FlashcardReviewRepository` (spaced repetition per-card review states stored in `flashcardReviews`)
- `database/services/` — Concrete application service implementations:
  - `DexieTermService` → `TermService` (atomic `createAndAssignTerm` across `terms` + `subjectTerms` stores)
  - `DexieQuizEditorService` → `QuizEditorService` (atomic quiz authoring save across `questions` + `quizzes` stores; conditional `questionVersion` bumps; re-snapshots `questionVersion` into quiz items; normalizes `tags` through domain `normalizeTags` on question create/update)
- `database/index.ts` — Barrel re-export of database core, startup services, schema versions, and repository singletons

## Local Contracts

- Imports from `domain/` (contract interfaces, model types, annotation value shapes) and `shared/` (storage keys) — never from features. Scoped exception: `DexieQuizDraftRepository` and the `quizEditingDrafts` table typing import the application-layer `QuizDraft` DTO and `QuizDraftRepository` contract (dependency inversion for application-owned persistence contracts).
- All repositories are exported as module-level singletons (e.g., `dexieQuestionRepository`).
- `DexieQuizSessionRepository.createSession()` uses `db.transaction('rw', ...)` across `quizSessions`, `quizzes`, and `questions` stores to atomically capture immutable `questionSnapshots`.
- `DexieQuizEditorService.saveQuiz()` runs a single `db.transaction('rw', [questions, quizzes])`: applies all question changes (create or update with conditional version bump), resolves canvas `tempId`s to question ids, rewrites the quiz's `questionIds`/`items`, and re-snapshots `questionVersion` per item — the operation is atomic.
- Schema versioning: v1 (Phase 5), v2 (Phase 5.3 — subjects/terms), v3 (SubjectTerm junction — terms become global), v4 (quizEditingDrafts crash-recovery store), v5 (flashcardReviews spaced repetition store).

- Database name: `lunaclair-db`.
- Migration is idempotent — guarded by localStorage flags for v1/v2/v3 data passes, native Dexie upgrade for schema v3.
- Seeding is idempotent — skipped if `subjects` store is non-empty (seed-once: Dexie owns the local catalog after first hydration; D1 is never re-applied).
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
