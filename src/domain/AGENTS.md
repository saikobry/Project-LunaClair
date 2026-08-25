# src/domain/ — Business Domain Models

## Purpose

Pure business domain models and logic — interfaces, types, and pure functions that describe the problem space. Domain modules must have zero React or UI dependencies.

## Ownership

Reserved domains:
- `reader/` — Document reading models, `DocumentRepository` and `AnnotationRepository` async contract interfaces, `DocumentContentRepository` + `ImportedDocumentContent` (locally imported document markdown keyed by `documentId` — the explicit local representation of an imported material's content, distinct from the SW network cache), `DocumentNotFoundError` typed domain error, annotation value types (`annotation.types.ts`: `HighlightItem`, `DrawingPath`, `Point`, `HighlightColor`, `AnnotationMode`, `DrawingTool`)
- `quiz/` — Assessment engine: question models (5 types: `multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`), quiz/session models, `QuizContentRepository` async contract for the **remote** D1 quiz snapshot (`GET /api/quiz` — assembled shapes, fetched at material-import time), `virtualQuiz.ts` in-memory factory & deterministic question ordering, `QuestionRepository`/`QuizRepository`/`QuizSessionRepository` contracts (supporting multi-item/batch lookups, discriminated `CreateSessionInput`, and `getAllCompletedSessions` queries), strategy-pattern grading (`QuestionStrategy` + 5 implementations + `QuestionStrategyResolver`), pure `AssessmentService`, and pure tag helpers (`tags.ts` — `splitTagInput`/`tagKey`/`normalizeTags`/`mergeTags`: comma tokenization + case-preserving dedup normalization; the single source of truth applied at every tag write boundary and shared `TagInput`). (Note: the presentation badge palette lives in `features/quiz-management/quizBadgeAppearance.ts`).
- `library/` — Document/library catalog models, `LibraryRepository` async contract interface with DTOs (`CreateMaterialInput`, `UpdateMaterialInput`), `SubjectTerm` junction type and `SubjectTermRepository` contract for managing many-to-many Subject ↔ Term associations, `TermService` application service contract for atomic multi-entity term workflows, `CatalogRepository` async contract for the **remote** D1 catalog snapshot (`GET /api/catalog` — server state, never copied wholesale into Dexie) plus authoritative per-material resolution (`getMaterial` → `MaterialResolution` via `GET /api/catalog/materials/:id`, uncached, used by import), and `LibraryImportService` application service contract for atomic single/batch import and removal of material rows (`importMaterial`, `importMaterialBatch`, `removeImportedMaterial` across subject/term/material/questions/quizzes/document content)
- `flashcards/` — Spaced repetition domain: `Flashcard` domain mapping derived from `Question` (`questionToCard`), pure SM-2 scheduler (`review`, `isDue`, `createInitialReviewState`), deck ordering (`orderDeck`), and `FlashcardReviewRepository` async contract interface (supporting `getByKeys`, `getByMaterial`, and `getAllReviews`)
- `analytics/` — Pure learning analytics engine: canonical view types (`analytics.types.ts`), local timezone calendar date utilities (`dateUtils.ts`), pure consecutive streak calculation with grace evaluation (`streakEngine.ts`), 365-day volume activity calendar generator (`activityEngine.ts`), topic/subject mastery scoring with difficulty multipliers ($1.0, 1.5, 2.0$) and deterministic tie-breaking (`masteryEngine.ts`), mutually exclusive card maturity partition and review forecast (`retentionEngine.ts`), and global study overview metrics aggregation (`overviewEngine.ts`)
- `ai/` — AI Tutor and study assistant domain: canonical message & thread types (`ai.types.ts`: `AiChatMessage`, `AiChatRequest`, `AiGenerationRequest`, `AiStructuredOutputValidator<T>`, `AiGenerationError`, `AiStreamEvent`, `AiTutorMode`, `AiUsage`, `AiThread`, `AiMessageRecord`, `AiMessageStatus`), provider-agnostic capability port (`AiService.ts`: `streamChat()`, `generateStructured()`), and local thread persistence port (`AiChatRepository.ts` — local-only persistence contract, orphan recovery, cascade deletion)
- `generator/` — AI content generation domain models and pure validators (`generator.types.ts`, `questionDraftValidation.ts`): structured question and flashcard drafts, strict question payload validation across all 5 quiz types, atomic flashcard definitions, and provenance metadata mapping (`ai-generated`, `sec:...`)

## Local Contracts

- Zero React or UI dependencies. Domain modules import only from other domains or pure TypeScript libraries.
- Importable by any feature, application, or infrastructure layer.
- Domain logic must be testable without a browser environment.
- Analytics engines must never mutate their input arrays or domain objects.
- All timestamps in storage remain UTC ISO 8601 strings; date-key aggregations parse timestamps as instants and map to local calendar dates via `dateUtils.toLocalDateKey()`. Due comparisons use timestamp instants (`dueAt <= referenceDate`) before forecast grouping.
- Historical quiz attribution is derived strictly from immutable `questionSnapshots` on `QuizSession`, never from mutable question records. Subject attribution follows `questionSnapshots.materialId` → `material.subjectId` → `Subject`.
- `CardMaturityBreakdown` strictly partitions cards into mutually exclusive buckets (`new`, `learning`, `review`, `mastered`) satisfying `newCount + learningCount + reviewCount + masteredCount === totalCards`.
- Global quiz accuracy is question-weighted (`totalCorrectAnswers / totalAnsweredQuestions * 100`).
- Topic mastery counts total answer attempts (`attemptCount`), not unique questions. Status includes `unattempted`, `needs_practice`, `proficient`, `mastered` (mastered requires $\ge 85\%$ weighted score AND $\ge 3$ attempts). Strengths and weaknesses require $\ge 3$ attempts and sort deterministically.
- `LibraryRepository` is the async contract (interface) that infrastructure implementations (e.g., `DexieLibraryRepository`) must satisfy.
- `DocumentRepository` is the async contract for resolving `StudyMaterial` → `Document` (implemented by `ApiDocumentRepository` and `HybridDocumentRepository` in `src/infrastructure/api/`).
- `CatalogRepository.getMaterial` is the authoritative per-material resolution for import — one request returns the material plus its subject/term/subjectTerm relationships; **import must never require the full `CatalogSnapshot` in memory**.
- `AnnotationRepository` is the async contract for highlight/drawing persistence keyed by `documentId` (implemented by `DexieAnnotationRepository`).
- `QuestionRepository`, `QuizRepository`, `QuizSessionRepository`, `FlashcardReviewRepository` are async contracts for persistence (implemented by Dexie repositories in `src/infrastructure/database/repositories/`).

- `AssessmentService` is a pure domain service with zero persistence dependencies — validates, grades, and computes `QuizResult`/`QuizScore` via strategy dispatch.
- Tag casing policy (case-preserving display): stored tags keep the FIRST casing seen (`iOS` displays as `iOS`); `tagKey` (lowercase) is the derived canonical key for dedup/comparison and is never persisted. `normalizeTags` is the write-boundary normalization every tag write must pass through (repositories, editor service, migration).
- `virtualQuiz.ts` generates derived, in-memory Virtual Quiz domain objects (`virtual:quizzes:...`) without mutating database state.
- `Term` is a standalone global entity (no `subjectId` or `order`). Per-subject ordering and association is managed by `SubjectTerm` junction.
- `SubjectTerm` uses composite key `[subjectId+termId]` — prevents duplicate associations at the database level.
- `SubjectTermRepository` enforces: validated subject/term existence, automatic `max(order) + 1` on add, atomic sync/replace, and input uniqueness checks for `syncTerms`.
- `TermService` is the domain application service contract (`createAndAssignTerm(subjectId, title)`) for workflows spanning multiple aggregates — implemented by `DexieTermService` in infrastructure, supplied to features via `ApplicationContext`. Domain/feature code never imports Dexie directly.
- `TermRepository.deleteTerm(id)` atomically cascades: removes all `SubjectTerm` junction rows referencing `id` and clears `termId` on `StudyMaterial`.
- `TermRepository.upsertTerms(terms)` is the idempotent bulk upsert by id (insert-or-overwrite) used to sync canonical catalog terms into local state — e.g. `SyncDefaultTermsUseCase` writing the default academic terms after onboarding.
- `SubjectRepository.deleteSubject(id)` atomically cascades: removes `SubjectTerm` rows and clears `subjectId`/`termId` on associated `StudyMaterial`.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run build`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files — quiz subdomain uses `strategies/` subdirectory for strategy pattern implementations.
