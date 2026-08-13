# src/domain/ — Business Domain Models

## Purpose

Pure business domain models and logic — interfaces, types, and pure functions that describe the problem space. Domain modules must have zero React or UI dependencies.

## Ownership

Reserved domains:
- `reader/` — Document reading models, `DocumentRepository` and `AnnotationRepository` async contract interfaces, `DocumentNotFoundError` typed domain error, annotation value types (`annotation.types.ts`: `HighlightItem`, `DrawingPath`, `Point`, `HighlightColor`, `AnnotationMode`, `DrawingTool`)
- `quiz/` — Assessment engine: question models (5 types: `multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`), quiz/session models, `virtualQuiz.ts` in-memory factory & deterministic question ordering, `QuestionRepository`/`QuizRepository`/`QuizSessionRepository` contracts (supporting multi-item/batch lookups and discriminated `CreateSessionInput`), strategy-pattern grading (`QuestionStrategy` + 5 implementations + `QuestionStrategyResolver`), pure `AssessmentService`, the shared semantic badge palette (`quizBadgeAppearance.ts` — exhaustive `QUESTION_TYPE_APPEARANCE`/`DIFFICULTY_APPEARANCE` records plus the neutral `POINTS_APPEARANCE` chip, consumed by the authoring surfaces (canvas card, question bank); a new type/difficulty value fails the build until it gets an appearance), and pure tag helpers (`tags.ts` — `splitTagInput`/`tagKey`/`normalizeTags`/`mergeTags`: comma tokenization + case-preserving dedup normalization; the single source of truth applied at every tag write boundary and shared `TagInput`). Sourcing rule: type colors are literal hex (arbitrary domain assignment), difficulty + points reference theme tokens (borrowed sentiment vocabulary / token hygiene respectively))
- `library/` — Document/library catalog models, storage-oriented `MaterialSourceType` (`'bundled' | 'local' | 'firebase' | 'url' | 'generated'`), `LibraryRepository` async contract interface with DTOs (`CreateMaterialInput`, `UpdateMaterialInput`), `SubjectTerm` junction type and `SubjectTermRepository` contract for managing many-to-many Subject ↔ Term associations, and `TermService` application service contract for atomic multi-entity term workflows
- `flashcards/` — Spaced repetition domain: `Flashcard` domain mapping derived from `Question` (`questionToCard`), pure SM-2 scheduler (`review`, `isDue`, `createInitialReviewState`), deck ordering (`orderDeck`), and `FlashcardReviewRepository` async contract interface

## Local Contracts

- Zero React or UI dependencies. Domain modules import only from other domains or pure TypeScript libraries.
- Importable by any feature or service layer.
- Domain logic must be testable without a browser environment.
- `LibraryRepository` is the async contract (interface) that infrastructure implementations (e.g., `DexieLibraryRepository`) must satisfy.
- `DocumentRepository` is the async contract for resolving `StudyMaterial` → `Document` (implemented by `ApiDocumentRepository`).
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
- `SubjectRepository.deleteSubject(id)` atomically cascades: removes `SubjectTerm` rows and clears `subjectId`/`termId` on associated `StudyMaterial`.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — quiz subdomain uses `strategies/` subdirectory for strategy pattern implementations.
