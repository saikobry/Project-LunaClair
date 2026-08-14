# src/features/ — Feature Modules

## Purpose

Feature-based modules, each containing everything needed for that feature: components, hooks, assets, types, styles, and utilities. Features own their business capabilities and may consume another feature only through its curated root `index.ts` contract.

## Ownership

| Feature | Status | Scope |
|---|---|---|
| `catalog/` | ✅ Implemented | Study content organization — unified Catalog capability consolidating the former `library/`, `subject/`, and `settings/` features. Materials (LibraryScreen, MaterialCard, material CRUD hooks), available (AvailableMaterialsScreen — the remote D1 catalog surfaced at `/available` with import/remove actions, `useAvailableCatalog`/`useImportMaterial`/`useRemoveImportedMaterial` hooks), subjects (SubjectWorkspace, subject CRUD/reorder hooks), and terms (TermManagerScreen, term CRUD + subject-term junction hooks) organized internally into `available/`, `materials/`, `subjects/`, `terms/`, and `shared/` sub-capabilities. Query key factory `catalogQueryKeys` owns material/subject/term cache namespaces plus the remote catalog (`['catalog', 'remote']`). |
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, TOC, TanStack Query + DI repositories |
| `quiz/` | ✅ Implemented | Assessment engine — question renderer (5 types), quiz player (QuizScreen/QuizStartView/QuizView/QuizResultView), session flow hooks, Subject Quiz Explorer tree & selection hooks, DI repositories |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, Quiz Catalog builder, QuestionEditorRegistry (5 type editors), application use-case adapters, publish/archive workflows |
| `flashcards/` | ✅ Implemented | Spaced-repetition study mode — Card projection from Question, SM-2 scheduling, 3D flip card player, rating flow, FlashcardReviewRepository hooks |
| `importer/` | 🔒 Reserved | Content import |
| `generator/` | 🔒 Reserved | AI content generation |

## Local Contracts

- **Public contracts only.** Cross-feature consumers import from `src/features/<feature>/index.ts`; internal feature paths are private.
- **Single ownership.** Every business capability (including UI, dialogs, hooks, query keys, and feature types) has one owning feature.
- **Curated barrels.** Root `index.ts` files export only stable, intentionally supported capabilities.
- **Domain-specific code stays in features.** `shared/` contains only domain-agnostic UI primitives, composites, and infrastructure utilities.
- Each feature contains its own: components/, hooks/, types/, utils/, services/, styles/
- Study content assets (markdown, figures) live in `public/materials/{sourceId}/` — not inside feature directories
- Feature orchestrator: `{Feature}Screen.tsx` — wires hooks to views
- Workspace-embedded screens (ReaderScreen, QuizScreen `embedded`, QuizManagementScreen, FlashcardScreen) render bare content — the MaterialWorkspace provides the Page shell, title, and tab bar. Navigation is handled by AppSidebar + tabs, not by per-screen buttons.
- Feature view: `{Feature}View.tsx` — pure presentation
- Query hooks are separated from mutation hooks. Mutations live in `hooks/mutations/`; subject and term queries live in `hooks/queries/`.
- UI components contain 0 async data-fetching logic and 0 direct imports of TanStack Query or concrete storage classes. Mutation hooks delegate workflows to `src/application/` use cases.
- Subject term UI: `SubjectTermList` is strictly presentational (props `{ terms, onReorder, onRemove }` — zero fetching/mutations/modals); `SubjectTermsTab` is the container owning term queries and mutations and rendering the add-existing/create/unlink modals. Modal open-state for add-existing/create is lifted to `SubjectWorkspace` (controlled props `showAddExisting`/`showCreate` + open/close callbacks) so the Page header hosts tab-specific actions. `useSubjectTermMutations` provides add/remove/reorder (optimistic) and create-and-assign hooks targeting `['subject', 'terms', subjectId]` query keys.
- Feature-owned cache namespaces: `catalogQueryKeys` owns material, subject, and term queries; `assessmentQueryKeys` owns quiz queries; `flashcardQueryKeys` owns flashcard review queries.
- `catalog/available/` owns discovery of canonical (D1) materials and the remote → local import lifecycle; `catalog/materials/` owns the local material lifecycle and editing/management. `available` reads local library state (`useLibrary`) for import status and invalidates the shared `catalogQueryKeys` namespaces on import/remove — runtime coupling, not ownership.
- `catalog/` internals: screens and sub-capabilities live under `available/components`, `materials/components`, `subjects/components`, `terms/components`; modals under `*/modals`; hooks under `*/hooks` with `queries/` and `mutations/` subdirectories. `catalog/shared/` holds catalog-internal helpers (`useTermGroupedSelection`, `TermGroupedSelector`, `library.stylex` styles). These internal paths are private — outside consumers import only from `catalog/index.ts` (the reader/quiz direct imports listed under no-barrel-import below are the sole exceptions).
- Quiz hooks are grouped under `quiz/hooks/`: `queries/`, `mutations/`, `session/`, and `repositories/`; `quiz/index.ts` re-exports the full hook set.
- Accepted cycle: `catalog` screens embed `quiz` tree capabilities (`SubjectQuizTab` → quiz tree hooks + `QuizLaunchRequest`) while `quiz/hooks/queries/useSubjectQuizTree` consumes catalog data hooks — call-time-only (no module-init-time side effects may be added to any module in the cycle). The cross-feature edges of this cycle use the direct paths listed in the no-barrel-import contract below.
- **react-doctor `no-barrel-import` — resolved project-wide (Aug 2026).** Per user direction, every barrel import the rule flagged was converted to a direct module path (shared-UI sub-barrels like `shared/ui/Button`/`Input`/`Card`/`Dialog`/`Page`, `shared/hooks`, `shared/constants`, `app/providers`, `domain/quiz` badge appearances, and the cross-feature barrels below). `react-doctor --verbose` reports zero occurrences; do not re-introduce barrel imports for these symbols. Feature root barrels remain the preferred contract for NEW consumption (ADR-009 public contracts) — new cross-feature imports should still route through barrels unless the doctor rule flags them.
  - **Cross-feature direct paths (user-directed, Aug 2026) — the complete list:** `AppShell` → `quiz/QuizScreen` (default), `quiz/types/quizFeature.types` (`QuizLaunchRequest`), `quiz-management/canvas/QuizCanvasBuilder`, `shared/constants/storageKeys`, `app/providers/FocusModeContext`, `catalog/available/components/AvailableMaterialsScreen`; `MaterialWorkspace` → `reader/ReaderScreen`, `quiz/QuizScreen`, `quiz-management/QuizManagementScreen`, `flashcards/FlashcardScreen`; `AppSidebar` → `catalog/subjects/hooks/queries/useSubject`, `catalog/materials/hooks/queries/useMaterial`; `SubjectQuizTab` → `quiz/hooks/queries/useSubjectQuizTree`, `quiz/hooks/queries/useQuizTreeSelection`, `quiz/types/quizFeature.types`; `useSubjectQuizTree` → `catalog/materials/hooks/queries/useLibrary`, `catalog/terms/hooks/queries/useTerms`; `ReaderScreen` → `catalog/materials/hooks/queries/useMaterial`; `FlashcardScreen` → `quiz/hooks/queries/useQuestions`, `quiz/hooks/queries/useQuizzes`. Extend this list only when the doctor rule flags a new site. The list is maintained manually (no lint rule enforces it) — keep it in sync whenever cross-feature imports change.
  - **Expected side effect (accepted):** the barrels above — and feature/shared/app/domain barrels generally — now have zero importers and appear under the separate `deslop/unused-file` rule. This is expected: barrels are retained as ADR-009 public contracts. Do not delete retained barrels to silence unused-file warnings.


## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
| `src/features/quiz-management/AGENTS.md` | `src/features/quiz-management/` | Quiz & question authoring — Question Bank, Quiz Catalog, editors, publishing |
