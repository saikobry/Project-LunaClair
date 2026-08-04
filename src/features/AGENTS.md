# src/features/ — Feature Modules

## Purpose

Feature-based modules, each containing everything needed for that feature: components, hooks, assets, types, styles, and utilities. Features own their business capabilities and may consume another feature only through its curated root `index.ts` contract.

## Ownership

| Feature | Status | Scope |
|---|---|---|
| `catalog/` | ✅ Implemented | Study content organization — unified Catalog capability consolidating the former `library/`, `subject/`, and `settings/` features. Materials (LibraryScreen, MaterialCard, material CRUD hooks), subjects (SubjectWorkspace, subject CRUD/reorder hooks), and terms (TermManagerScreen, term CRUD + subject-term junction hooks) organized internally into `materials/`, `subjects/`, `terms/`, and `shared/` sub-capabilities. Query key factory `catalogQueryKeys` owns material/subject/term cache namespaces. |
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, TOC, TanStack Query + DI repositories |
| `quiz/` | ✅ Implemented | Assessment engine — question renderer (5 types), quiz player (QuizScreen/QuizStartView/QuizView/QuizResultView), session flow hooks, Subject Quiz Explorer tree & selection hooks, DI repositories |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, Quiz Catalog builder, QuestionEditorRegistry (5 type editors), application use-case adapters, publish/archive workflows |
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
- Workspace-embedded screens (ReaderScreen, QuizScreen `embedded`, QuizManagementScreen) render bare content — the MaterialWorkspace provides the Page shell, title, and tab bar. Navigation is handled by AppSidebar + tabs, not by per-screen buttons.
- Feature view: `{Feature}View.tsx` — pure presentation
- Query hooks are separated from mutation hooks. Mutations live in `hooks/mutations/`; subject and term queries live in `hooks/queries/`.
- UI components contain 0 async data-fetching logic and 0 direct imports of TanStack Query or concrete storage classes. Mutation hooks delegate workflows to `src/application/` use cases.
- Subject term UI: `SubjectTermList` is strictly presentational (props `{ terms, onReorder, onRemove }` — zero fetching/mutations/modals); `SubjectTermsTab` is the container owning queries, mutations, and modal state. `useSubjectTermMutations` provides add/remove/reorder (optimistic) and create-and-assign hooks targeting `['subject', 'terms', subjectId]` query keys.
- Feature-owned cache namespaces: `catalogQueryKeys` owns material, subject, and term queries; `assessmentQueryKeys` owns quiz queries.
- `catalog/` internals: screens and sub-capabilities live under `materials/components`, `subjects/components`, `terms/components`; modals under `*/modals`; hooks under `*/hooks` with `queries/` and `mutations/` subdirectories. `catalog/shared/` holds catalog-internal helpers (`useTermGroupedSelection`, `TermGroupedSelector`, `library.stylex` styles). These internal paths are private — outside consumers import only from `catalog/index.ts`.
- Quiz hooks are grouped under `quiz/hooks/`: `queries/`, `mutations/`, `session/`, and `repositories/`; `quiz/index.ts` re-exports the full hook set.
- Accepted cycle: `catalog` screens embed `quiz` tree capabilities (`SubjectQuizTab` → quiz barrel) while `quiz/hooks/queries/useSubjectQuizTree` consumes catalog data hooks (via the catalog barrel). This is a benign call-time-only cycle — no module-init-time side effects may be added to any module in the cycle.
- **react-doctor `no-barrel-import` waiver (feature root barrels).** The rule flags cross-feature imports of `catalog`/`quiz`/`quiz-management`/`reader` root `index.ts` barrels as a bundle-size risk. Waived with evidence — the rule's own recipe says to suppress when Vite tree-shakes barrels, and it is proven to: unused barrel exports (`useQuizSessions`, `useQuizzes`, `TermGroupedSelector`, `useTermGroupedSelection`) are absent from the production bundle (measured via unminified `vite build`). The suggested "fix" (direct imports into `hooks/`, `queries/`, `components/`, `types/`) is additionally prohibited by this doc's import rules + ADR-009. Authority: AGENTS.md import rules + ADR-009. Review condition: re-evaluate if the import policy changes or dead feature code ever appears in the bundle. Do NOT apply direct-path "fixes" to feature barrel imports to appease this rule.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
| `src/features/quiz-management/AGENTS.md` | `src/features/quiz-management/` | Quiz & question authoring — Question Bank, Quiz Catalog, editors, publishing |
