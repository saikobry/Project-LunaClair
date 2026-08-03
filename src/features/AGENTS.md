# src/features/ — Feature Modules

## Purpose

Feature-based modules, each containing everything needed for that feature: components, hooks, assets, types, styles, and utilities. Features own their business capabilities and may consume another feature only through its curated root `index.ts` contract.

## Ownership

| Feature | Status | Scope |
|---|---|---|
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, TOC, TanStack Query + DI repositories |
| `library/` | ✅ Implemented | Study Library — material grid, CRUD modals, material query/mutation hooks via TanStack Query, dependency-injected repository (`useLibraryRepository`) |
| `quiz/` | ✅ Implemented | Assessment engine — question renderer (5 types), quiz player (QuizScreen/QuizStartView/QuizView/QuizResultView), session flow hooks, Subject Quiz Explorer tree & selection hooks, DI repositories |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, Quiz Catalog builder, QuestionEditorRegistry (5 type editors), application use-case adapters, publish/archive workflows |
| `subject/` | ✅ Implemented | Subject workspace — Materials / Quiz / Terms tabs; term management UI (view, reorder, unlink, attach existing, create-and-assign via `TermService`) |
| `importer/` | 🔒 Reserved | Content import |
| `generator/` | 🔒 Reserved | AI content generation |
| `settings/` | 🔒 Reserved | App settings |

## Local Contracts

- **Public contracts only.** Cross-feature consumers import from `src/features/<feature>/index.ts`; internal feature paths are private.
- **Single ownership.** Every business capability (including UI, dialogs, hooks, query keys, and feature types) has one owning feature.
- **Curated barrels.** Root `index.ts` files export only stable, intentionally supported capabilities.
- **Domain-specific code stays in features.** `shared/` contains only domain-agnostic UI primitives, composites, and infrastructure utilities.
- Each feature contains its own: components/, hooks/, types/, utils/, services/, styles/
- Study content assets (markdown, figures) live in `public/materials/{sourceId}/` — not inside feature directories
- Feature orchestrator: `{Feature}Screen.tsx` — wires hooks to views
- Workspace-embedded screens (ReaderScreen, QuizScreen `embedded`, QuizManagementScreen) render bare content — the MaterialWorkspace provides the Page shell, title, and tab bar. Navigation is handled by AppSidebar + tabs, not by per-screen buttons.
- Feature view: `{Feature}View.tsx` — pure presentation
- Query hooks are separated from mutation hooks. Mutations live in `hooks/mutations/`; subject and term queries live in `hooks/queries/`.
- UI components contain 0 async data-fetching logic and 0 direct imports of TanStack Query or concrete storage classes. Mutation hooks delegate workflows to `src/application/` use cases.
- Subject term UI: `SubjectTermList` is strictly presentational (props `{ terms, onReorder, onRemove }` — zero fetching/mutations/modals); `SubjectTermsTab` is the container owning queries, mutations, and modal state. `useSubjectTermMutations` provides add/remove/reorder (optimistic) and create-and-assign hooks targeting `['subject', 'terms', subjectId]` query keys.
- Feature-owned cache namespaces: `libraryQueryKeys` owns material queries, `subjectQueryKeys` owns subjects and terms, and `assessmentQueryKeys` owns quiz queries.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
| `src/features/quiz-management/AGENTS.md` | `src/features/quiz-management/` | Quiz & question authoring — Question Bank, Quiz Catalog, editors, publishing |
