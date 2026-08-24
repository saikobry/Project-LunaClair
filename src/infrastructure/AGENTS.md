# src/infrastructure/ — Persistence and API Layer

## Purpose

Dexie/IndexedDB local database and remote API adapters: schema definition, database lifecycle (open, migrate, seed), API repository implementations, and concrete repository/service implementations satisfying domain contracts.

## Ownership

- `api/` — Concrete remote API repository implementations:
  - `ApiCatalogRepository.ts` → `CatalogRepository` (`GET /api/catalog` snapshot, uncached `GET /api/catalog/materials/:id` resolution)
  - `ApiDocumentRepository.ts` → `DocumentRepository` (`GET /api/documents/:documentId`)
  - `ApiQuizContentRepository.ts` → `QuizContentRepository` (`GET /api/quiz` snapshot)
  - `HybridDocumentRepository.ts` → `DocumentRepository` (Dexie `documentContents` local-first fallback to remote API)
  - `markdownPreprocessor.ts` → figure image relative URL transformer
- `ai/` — Concrete AI gateway adapters:
  - `WorkerAiAdapter.ts` → `AiService` (consumes streaming SSE events from Cloudflare Worker AI `/api/ai/chat`)
  - `MockAiAdapter.ts` → `AiService` (deterministic mock token stream for test suites)
- `database/schema.ts` — Version 1/2/3/4/5/6/7/8/9 Dexie schemas (v3 adds `subjectTerms` composite key `[subjectId+termId], subjectId, termId`, strips `subjectId` and `order` from `terms`; v4 adds `quizEditingDrafts` `'draftId, quizId, materialId, updatedAt'` for quiz canvas crash recovery; v5 adds `flashcardReviews` `'key, materialId, dueAt, lastReviewedAt'` for spaced-repetition state; v6 adds `documentContents` `'sourceId'` — locally imported document markdown, the explicit local representation of an imported material's content; v7 removes the legacy `sourceType` index from `materials`; v8 rekeys `documentContents` to `'documentId'` (vocabulary rename, with a data-copy upgrade); v9 adds `aiThreads` `'id, materialId, mode, createdAt, updatedAt'` and `aiMessages` `'id, threadId, role, status, createdAt'` for local-first AI chat persistence)
- `database/LunaClairDatabase.ts` — `Dexie` subclass with typed `Table` properties. Singleton `db`. v3 upgrade migration reads legacy `terms` (with `subjectId`/`order`), bulk-inserts `subjectTerms` rows, and strips `subjectId`/`order` from `terms` records. v4 adds `quizEditingDrafts`. v5 adds `flashcardReviews`. v6 adds `documentContents`. v7 drops the `sourceType` index. v8 rekeys `documentContents` from `sourceId` to `documentId` (rewrites existing records). v9 adds `aiThreads` and `aiMessages`.
- `database/DatabaseMigrator.ts` — One-time migration of legacy `localStorage` data (materials, highlights, drawings) into IndexedDB. Writes `databaseVersion`, `lastMigration`, `createdAt` metadata. v3 schema migration is handled natively by Dexie `version(3).upgrade()`; the v3 data pass (`lunaclair.migration.v3.complete`) normalizes stored question tags via domain `normalizeTags` (strip `#`, dedup case-insensitively, preserve first-seen casing).
- `database/DatabaseInitializer.ts` — Startup orchestrator: `db.open()` → `migrateIfNeeded()`. Deliberately **no seeding** — the canonical catalog lives in D1 and is surfaced via the API as "Available Materials"; users explicitly import materials into the local library (catalog-first, user-selected library model).
- `database/repositories/` — Concrete repository implementations. `DexieLibraryRepository` performs raw material persistence; material association validation belongs to application use cases.
  - `DexieAiChatRepository` → `AiChatRepository` (local-first thread & message persistence, orphan recovery, cascade delete)
  - `DexieQuestionRepository` → `QuestionRepository` (normalizes `tags` through domain `normalizeTags` on create/update)
  - `DexieQuizRepository` → `QuizRepository`
  - `DexieQuizSessionRepository` → `QuizSessionRepository` (multi-store transactions for immutable `questionSnapshots`; `getAllCompletedSessions` query)
  - `DexieLibraryRepository` → `LibraryRepository`
  - `DexieAnnotationRepository` → `AnnotationRepository`
  - `DexieSubjectRepository` → `SubjectRepository` (cascade: removes `subjectTerms` rows and clears `subjectId`/`termId` on `materials` on delete)
  - `DexieTermRepository` → `TermRepository` (cascade: removes `subjectTerms` rows and clears `termId` on `materials` on delete; `upsertTerms` bulk-puts by id for default-term sync)
  - `DexieSubjectTermRepository` → `SubjectTermRepository` (manages many-to-many Subject ↔ Term associations with composite key `[subjectId+termId]`)
  - `DexieQuizDraftRepository` → application `QuizDraftRepository` (crash-recovery drafts in `quizEditingDrafts`; latest-draft lookups by quiz or material)
  - `DexieFlashcardReviewRepository` → `FlashcardReviewRepository` (spaced repetition per-card review states stored in `flashcardReviews`; `getAllReviews` query)
  - `DexieDocumentContentRepository` → `DocumentContentRepository` (locally imported document markdown keyed by `documentId` in `documentContents`)
  - `DexieAnalyticsRepository` → `AnalyticsRepository` (multi-table indexed query coordination over `quizSessions`, `flashcardReviews`, `questions`, `materials`, `subjects`; delegates analytics calculations to pure domain engines)
- `database/services/` — Concrete application service implementations:
  - `DexieTermService` → `TermService` (atomic `createAndAssignTerm` across `terms` + `subjectTerms` stores)
  - `DexieQuizEditorService` → `QuizEditorService` (atomic quiz authoring save across `questions` + `quizzes` stores; conditional `questionVersion` bumps; re-snapshots `questionVersion` into quiz items; normalizes `tags` through domain `normalizeTags` on question create/update)
  - `DexieLibraryImportService` → `LibraryImportService` (atomic import/removal across `subjects`, `terms`, `subjectTerms`, `materials`, `questions`, `quizzes`, `documentContents` stores)

## Local Contracts

- Imports from `domain/` (contract interfaces, model types, annotation value shapes) and `shared/` (storage keys) — never from features. Scoped exception: `DexieQuizDraftRepository` and the `quizEditingDrafts` table typing import the application-layer `QuizDraft` DTO and `QuizDraftRepository` contract (dependency inversion for application-owned persistence contracts).
- All repositories are exported as module-level singletons (e.g., `dexieQuestionRepository`, `apiCatalogRepository`).
- `DexieQuizSessionRepository.createSession()` uses `db.transaction('rw', ...)` across `quizSessions`, `quizzes`, and `questions` stores to atomically capture immutable `questionSnapshots`.
- `DexieQuizEditorService.saveQuiz()` runs a single `db.transaction('rw', [questions, quizzes])`: applies all question changes (create or update with conditional version bump), resolves canvas `tempId`s to question ids, rewrites the quiz's `questionIds`/`items`, and re-snapshots `questionVersion` per item — the operation is atomic.
- Schema versioning: v1 (Phase 5), v2 (Phase 5.3 — subjects/terms), v3 (SubjectTerm junction — terms become global), v4 (quizEditingDrafts crash-recovery store), v5 (flashcardReviews spaced repetition store), v6 (documentContents imported-content store), v7 (drops legacy `sourceType` index), v8 (documentContents rekeyed `sourceId` → `documentId`).
- Database name: `lunaclair-db`.
- Migration is idempotent — guarded by localStorage flags for v1/v2/v3 data passes, native Dexie upgrade for schema v3.
- **No auto-hydration.** The app boots with an empty local library; the D1 catalog is surfaced through the API and materials are imported on user action via `LibraryImportService`. Dexie is the user's local selection/working state; D1 is the canonical platform catalog; Service Worker Cache Storage is a network-resource cache and is never the source of truth for library membership. The one non-import write of catalog rows is `DexieTermRepository.upsertTerms` via `SyncDefaultTermsUseCase` at onboarding completion (user-initiated) — never on boot.
- `DexieSubjectTermRepository.addTerm()` validates subject and term existence, prevents duplicate associations, and auto-computes `max(order) + 1`.
- `DexieTermService.createAndAssignTerm()` runs a single `db.transaction('rw', [terms, subjectTerms, subjects])` that creates the global `Term`, validates the subject, and inserts the `SubjectTerm` junction with `max(order) + 1` — the operation is atomic.
- `DexieSubjectTermRepository.syncTerms()` validates all term IDs exist, input uniqueness, and atomically replaces the complete association set.
- `DexieLibraryRepository.createMaterial()` and `updateMaterial()` validate that if `termId` is set, the `(subjectId, termId)` junction record exists.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run` — Dexie persistence, database migration, and repository unit/integration tests.
- `npm run build`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files — `api/`, `database/repositories/`, and `database/services/` are structured subdirectories under infrastructure.
