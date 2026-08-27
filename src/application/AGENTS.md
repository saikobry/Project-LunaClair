# src/application/ — Application Layer

## Purpose

Framework-agnostic use cases coordinating domain contracts between React adapters and infrastructure.

## Ownership

- `use-cases/quiz/` owns quiz session start (`StartQuizSessionUseCase`), atomic evaluation & submission (`SubmitQuizSessionUseCase`), and session abandonment (`AbandonQuizSessionUseCase`).
- `use-cases/quiz-management/` owns question and quiz authoring workflows, including `SaveQuizUseCase` (concurrency guard → draft validation → version increment rules → atomic commit via `QuizEditorService`, returns the `SaveQuizResult` discriminated union).
- `use-cases/library/` owns material association validation, CRUD workflows, and the material/subject import/removal workflows (`ImportMaterialUseCase` — resolves the material authoritatively per-id via `CatalogRepository.getMaterial` (never the full snapshot), fetches document/quiz content, and persists atomically via `LibraryImportService`; `ImportSubjectUseCase` — batch imports an entire subject's unimported materials idempotently in one atomic transaction; `RemoveImportedMaterialUseCase` — local-only removal that leaves the canonical D1 catalog entry untouched; `SyncDefaultTermsUseCase` — syncs the canonical academic terms (Prelim/Midterm/Finals) from `CatalogRepository.getCatalog()` into the local terms store, invoked at first-run onboarding completion).
- `use-cases/subject/` owns subject & term CRUD, subject reordering, subject-term junctions, and cascade workflows (`CreateSubjectUseCase`, `UpdateSubjectUseCase`, `ReorderSubjectsUseCase`, `DeleteSubjectUseCase`, `CreateTermUseCase`, `UpdateTermUseCase`, `DeleteTermUseCase`, `CreateAndAssignTermUseCase`, `SyncSubjectTermsUseCase`, `ReorderSubjectTermsUseCase`, `AddTermToSubjectUseCase`, `RemoveTermFromSubjectUseCase`).
- `use-cases/reader/` owns annotation persistence workflows (`SaveHighlightUseCase`, `SaveDrawingUseCase`, `ClearAnnotationsUseCase`).
- `use-cases/content/` owns document content persistence workflows (`UpdateDocumentContentUseCase` — updates local markdown representation in Dexie without coupling to UI features or library discovery).
- `use-cases/flashcards/` owns spaced-repetition review state transitions and persistence coordination (`RecordFlashcardReviewUseCase`).
- `use-cases/analytics/` owns analytics coordination workflows (`GetGlobalAnalyticsUseCase`, `GetSubjectAnalyticsUseCase`, `GetMaterialAnalyticsUseCase` — delegates raw data aggregation and calculations via `AnalyticsRepository` port).
- `use-cases/ai/` owns AI prompt/context construction, streamed chat execution with atomic turn persistence (`SendChatMessageUseCase`, `AiContextBuilder`), and thread lifecycle management (`GetOrCreateAiThreadUseCase`, `GetAiThreadMessagesUseCase`, `DeleteAiThreadUseCase`, `ClearChatHistoryUseCase`).
- `use-cases/generator/` owns AI structured content synthesis workflows (`GenerateQuestionsUseCase`, `BatchCreateQuestionsUseCase`, `GenerateFlashcardsUseCase`, `BatchCreateFlashcardsUseCase`) coordinating `AiService.generateStructured`, section-bounded context extraction, strict domain draft validators, and atomic batch persistence to `QuestionRepository.createQuestionsBatch` with default `status: 'draft'`.
- `use-cases/importer/` owns content extraction and import orchestration (`ExtractContentUseCase` — resolves format importer, executes extraction, and applies multi-pass Markdown conversion; `CommitImportUseCase` — generates material/document IDs, sets metadata, persists original file blob to `importAssets`, and atomically registers material with `materials` and `documentContents` stores; `CleanupImportWithAiUseCase` — opt-in AI markdown cleanup returning dual-version original/cleaned diff).
- `use-cases/package/` owns study package materialization and import orchestration (`MaterializeStudyPackageUseCase` — extracts canonical material, questions, quizzes, and assets from repositories, strips personal learning/sync histories, assigns package-scoped `pkg_*` identifiers, rewires `lc-asset://` markdown URIs; `ImportStudyPackageUseCase` — validates package graph, executes collision-free ID remapping, and commits entities atomically to Dexie).
- `use-cases/sync/` owns application sync workflows (`ResolveConflictDraftUseCase` — resolves document divergence snapshots with keep_server, keep_local, or merge strategies atomically updating document content and outbox queue; `TriggerSyncUseCase` — triggers single-flight sync convergence; `GetSyncStatusUseCase` — surfaces current sync status and diagnostics; `GetConflictDraftsUseCase` — retrieves unresolved conflict drafts).
- `sync/` owns cloud synchronization orchestration (`SyncEngine` coordinating the 4-step convergence cycle: pull → push outbox → pull catchup → finalize idle), single-flight mutex (`syncMutex` merging concurrent calls and executing requested follow-up cycles), observable in-memory projection (`SyncStatusStore` with `rehydrateFromStorage` and reactive listeners), and exponential backoff retry policies (`syncRetryPolicy` / `calculateRetryDelay`).
- `quiz-management/drafts/` owns the quiz canvas Application Session DTOs (`QuizDraft`/`QuestionDraft`), draft validation (`quizDraftValidation`), the `QuizDraftRepository` crash-recovery contract, and draft seeding helpers. Drafts carry UI session concerns (`tempId`, `isDirty`) and are never persisted to the Question Bank or Quiz Catalog.

## Local Contracts

- Use cases and application services never import React, TanStack Query, Dexie, browser APIs, or UI components.
- `SyncEngine` encapsulates the 4-step sync convergence protocol (pull -> push batches -> pull -> finalize idle), enforces a single-flight mutex with follow-up cycle execution, handles offline detection gracefully, and updates `SyncStatusStore`.

- Dependencies are domain repository/service contracts, domain models/services, and application input/output types.
- Import must never require the full catalog snapshot in memory — `ImportMaterialUseCase` resolves via `CatalogRepository.getMaterial`. (The snapshot read in `SyncDefaultTermsUseCase` is onboarding-scoped default-term sync, not import.)
- Default-term sync is insert-if-missing by id, idempotent, and never overwrites local term edits; fetch failures return `{ synced: false }` (terms still arrive later via import) while persistence failures surface as real errors.
- React hooks remain thin adapters for cache behavior and presentation concerns.
- `SaveQuizUseCase` never touches IndexedDB draft storage or query caches — draft deletion and cache invalidation belong to the UI editor layer.
- Version increment rule: `questionVersion` bumps only when question prompt or answer payload content changes; points, order, and quiz-specific metadata never bump.

## Work Guidance

- Keep persistence details in repository implementations.
- Keep grading pure in `AssessmentService`; submission coordinates grading and completion.

## Verification

- `npm run test:run`
- `npm run build`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files.
