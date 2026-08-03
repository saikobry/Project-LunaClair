# src/features/ — Feature Modules

## Purpose

Feature-based modules, each containing everything needed for that feature: components, hooks, assets, types, styles, and utilities. Features are isolated — they import from `shared/`, `domain/`, or `services/`, but not from other features.

## Ownership

| Feature | Status | Scope |
|---|---|---|
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, TOC, TanStack Query + DI repositories |
| `library/` | ✅ Implemented | Study Library — material grid, CRUD modals, async mutation hooks via TanStack Query, dependency-injected repository (`useLibraryRepository`); the materials query hook (`useLibrary`) lives in `src/shared/hooks/` |
| `quiz/` | ✅ Implemented | Assessment engine — question renderer (5 types), quiz player (QuizScreen/QuizStartView/QuizView/QuizResultView), session flow hooks (loader, progress, submission, persistence), Subject Quiz Explorer tree & selection hooks, DI repositories |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, Quiz Catalog builder, QuestionEditorRegistry (5 type editors), application use-case adapters, publish/archive workflows |
| `subject/` | ✅ Implemented | Subject workspace — Materials / Quiz / Terms tabs; term management UI (view, reorder, unlink, attach existing, create-and-assign via `TermService`) |
| `importer/` | 🔒 Reserved | Content import |
| `generator/` | 🔒 Reserved | AI content generation |
| `settings/` | 🔒 Reserved | App settings |

## Local Contracts

- **No cross-feature imports.** A feature must not import from another feature.
- Each feature contains its own: components/, hooks/, types/, utils/, services/, styles/
- Study content assets (markdown, figures) live in `public/materials/{sourceId}/` — not inside feature directories
- Feature orchestrator: `{Feature}Screen.tsx` — wires hooks to views
- Workspace-embedded screens (ReaderScreen, QuizScreen `embedded`, QuizManagementScreen) render bare content — the MaterialWorkspace provides the Page shell, title, and tab bar. Navigation is handled by AppSidebar + tabs, not by per-screen buttons.
- Feature view: `{Feature}View.tsx` — pure presentation
- Barrel export: `index.ts` re-exports the public API (usually just the Screen component)
- Query hooks are separated from mutation hooks. Mutations generally live in `hooks/mutations/`; the subject feature groups term mutations in `hooks/useSubjectTermMutations.ts` (per its own plan) with the query hook in `hooks/useSubjectTermUsage.ts`.
- UI components contain 0 async data-fetching logic and 0 direct imports of TanStack Query or concrete storage classes. Mutation hooks delegate workflows to `src/application/` use cases.
- Subject term UI: `SubjectTermList` is strictly presentational (props `{ terms, onReorder, onRemove }` — zero fetching/mutations/modals); `SubjectTermsTab` is the container owning queries, mutations, and modal state. `useSubjectTermMutations` provides add/remove/reorder (optimistic) and create-and-assign hooks targeting `['library', 'terms', subjectId]` query keys.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
| `src/features/quiz-management/AGENTS.md` | `src/features/quiz-management/` | Quiz & question authoring — Question Bank, Quiz Catalog, editors, publishing |
