# src/domain/ — Business Domain Models

## Purpose

Pure business domain models and logic — interfaces, types, and pure functions that describe the problem space. Domain modules must have zero React or UI dependencies.

## Ownership

Reserved domains:
- `reader/` — Document reading models, `DocumentRepository` and `AnnotationRepository` async contract interfaces, `DocumentNotFoundError` typed domain error
- `quiz/` — Assessment engine: question models (5 types: `multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`), quiz/session models, `virtualQuiz.ts` in-memory factory & deterministic question ordering, `QuestionRepository`/`QuizRepository`/`QuizSessionRepository` contracts (supporting multi-item/batch lookups and discriminated `CreateSessionInput`), strategy-pattern grading (`QuestionStrategy` + 5 implementations + `QuestionStrategyResolver`), pure `AssessmentService`
- `library/` — Document/library catalog models, storage-oriented `MaterialSourceType` (`'bundled' | 'local' | 'firebase' | 'url' | 'generated'`), `LibraryRepository` async contract interface with DTOs (`CreateMaterialInput`, `UpdateMaterialInput`)
- `generator/` — AI content generation models

## Local Contracts

- Zero React or UI dependencies. Domain modules import only from other domains or pure TypeScript libraries.
- Importable by any feature or service layer.
- Domain logic must be testable without a browser environment.
- `LibraryRepository` is the async contract (interface) that infrastructure implementations (e.g., `DexieLibraryRepository`) must satisfy.
- `DocumentRepository` is the async contract for resolving `StudyMaterial` → `Document` (implemented by `LocalDocumentRepository`).
- `AnnotationRepository` is the async contract for highlight/drawing persistence keyed by `documentId` (implemented by `DexieAnnotationRepository`).
- `QuestionRepository`, `QuizRepository`, `QuizSessionRepository` are async contracts for assessment persistence (implemented by Dexie repositories in `src/infrastructure/database/repositories/`).
- `AssessmentService` is a pure domain service with zero persistence dependencies — validates, grades, and computes `QuizResult`/`QuizScore` via strategy dispatch.
- `virtualQuiz.ts` generates derived, in-memory Virtual Quiz domain objects (`virtual:quizzes:...`) without mutating database state.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — quiz subdomain uses `strategies/` subdirectory for strategy pattern implementations.
