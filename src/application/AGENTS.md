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
- `use-cases/ai/` owns AI prompt/context construction and streamed chat execution (`SendChatMessageUseCase`, `AiContextBuilder`).
- `quiz-management/drafts/` owns the quiz canvas Application Session DTOs (`QuizDraft`/`QuestionDraft`), draft validation (`quizDraftValidation`), the `QuizDraftRepository` crash-recovery contract, and draft seeding helpers. Drafts carry UI session concerns (`tempId`, `isDirty`) and are never persisted to the Question Bank or Quiz Catalog.

## Local Contracts

- Use cases never import React, TanStack Query, Dexie, browser APIs, or UI components.
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
