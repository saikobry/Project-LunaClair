# src/application/ — Application Layer

## Purpose

Framework-agnostic use cases coordinating domain contracts between React adapters and infrastructure.

## Ownership

- `use-cases/quiz/` owns quiz session start and atomic submission.
- `use-cases/quiz-management/` owns question and quiz authoring workflows, including `SaveQuizUseCase` (concurrency guard → draft validation → version increment rules → atomic commit via `QuizEditorService`, returns the `SaveQuizResult` discriminated union).
- `use-cases/library/` owns material association validation, CRUD workflows, and the material import/removal workflows (`ImportMaterialUseCase` — orchestrates remote catalog/document/quiz fetches and persists atomically via `LibraryImportService`; `RemoveImportedMaterialUseCase` — local-only removal that leaves the canonical D1 catalog entry untouched).
- `use-cases/subject/` owns subject-term and cascade workflows.
- `use-cases/reader/` owns annotation persistence workflows.
- `quiz-management/drafts/` owns the quiz canvas Application Session DTOs (`QuizDraft`/`QuestionDraft`), draft validation (`quizDraftValidation`), the `QuizDraftRepository` crash-recovery contract, and draft seeding helpers. Drafts carry UI session concerns (`tempId`, `isDirty`) and are never persisted to the Question Bank or Quiz Catalog.

## Local Contracts

- Use cases never import React, TanStack Query, Dexie, browser APIs, or UI components.
- Dependencies are domain repository/service contracts, domain models/services, and application input/output types.
- React hooks remain thin adapters for cache behavior and presentation concerns.
- `SaveQuizUseCase` never touches IndexedDB draft storage or query caches — draft deletion and cache invalidation belong to the UI editor layer.
- Version increment rule: `questionVersion` bumps only when question prompt or answer payload content changes; points, order, and quiz-specific metadata never bump.

## Work Guidance

- Keep persistence details in repository implementations.
- Keep grading pure in `AssessmentService`; submission coordinates grading and completion.

## Verification

- `npm run build`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files.
