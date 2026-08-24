# src/features/ — Feature Modules

## Purpose

Feature-based modules, each containing everything needed for that feature: components, hooks, assets, types, styles, and utilities. Features own their business capabilities and consume other features only through the approved direct module paths defined by ADR-010.

## Ownership

| Feature | Status | Scope |
|---|---|---|
| `catalog/` | ✅ Implemented | Study content organization — unified Catalog capability consolidating the former `library/`, `subject/`, and `settings/` features. Materials (LibraryScreen, MaterialCard, material CRUD hooks), available (AvailableMaterialsScreen — the remote D1 catalog surfaced at `/available` with title/description search, availability status filtering (All / Available / In Library), individual/batch import and remove actions, and a read-only `PreviewMaterialScreen` at `/available/:id/preview` that resolves the material authoritatively per-id and renders the document read-only with an Add-to-Library CTA; `useAvailableCatalog`/`useAvailableMaterial`/`usePreviewDocument`/`useImportMaterial`/`useImportSubject`/`useRemoveImportedMaterial` hooks), subjects (SubjectWorkspace, subject CRUD/reorder hooks), and terms (TermManagerScreen, term CRUD + subject-term junction hooks) organized internally into `available/`, `materials/`, `subjects/`, `terms/`, and `shared/` sub-capabilities. Query key factory `catalogQueryKeys` owns material/subject/term cache namespaces plus the remote catalog (`['catalog', 'remote']`) and per-material resolution (`['catalog', 'remote', 'material', id]`). |
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, TOC, TanStack Query + DI repositories |
| `quiz/` | ✅ Implemented | Assessment engine — question renderer (5 types), quiz player (QuizScreen/QuizStartView/QuizView/QuizResultView), session flow hooks (atomic evaluation & submission via `SubmitQuizSessionUseCase`, session abandonment via `AbandonQuizSessionUseCase`), Subject Quiz Explorer tree & selection hooks, DI repositories |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, Quiz Catalog builder, QuestionEditorRegistry (5 type editors), application use-case adapters, publish/archive workflows |
| `flashcards/` | ✅ Implemented | Spaced-repetition study mode — Card projection from Question, SM-2 scheduling, 3D flip card player, rating flow (`RecordFlashcardReviewUseCase`), `FlashcardReviewRepository` hooks |
| `writer/` | ✅ Implemented | WYSIWYG authoring and study material editing engine built on Lexical standard nodes and lossless Markdown transformation (H1–H6, multi-level lists, GFM tables, images, blockquotes, horizontal rules). |
| `analytics/` | ✅ Implemented | Learning analytics & insights dashboard — Study overview KPIs, card maturity distribution, 7-day review load forecast, subject/topic mastery matrix, and 52-week activity calendar. |
| `ai/` | ✅ Implemented (Phase 8A/8B/8C) | AI Study Assistant — streaming token hooks (`useAiStreamChat`), thread management & reload persistence (`useAiChatThread`), section-aware grounded context extraction (`extractSectionContext`), presentation components (`AiChatDrawer`, `AiDrawerToggleButton`, `AiChatMessage`, `AiChatMessageList`, `AiChatInput`, `AiModeSelector`, `AiStreamingIndicator`), and selection contextual actions ("Explain", "Simplify", "Example"). |
| `importer/` | 🔒 Reserved | Content import |
| `generator/` | 🔒 Reserved | AI content generation |

## Local Contracts

- **Direct-path contracts only (ADR-010).** Cross-feature consumers import only the approved direct module paths listed under no-barrel-import below; internal feature paths are private.
- **Architectural Boundary Guardrails (Oxlint):** Features must never import concrete infrastructure (`src/infrastructure/**`) or reintroduced legacy service modules. Enforced statically via Oxlint `no-restricted-imports`.
- **Dependency Flow Policy:**
  - `Features → Application`: Required for all write mutations and business workflows (`context.useCases.*`).
  - `Features → Domain`: Allowed for model types, value objects, and query contracts (`Question`, `StudyMaterial`, `ReviewState`).
  - `Features → Infrastructure`: Strictly forbidden.
  - `Features → Context Repositories`: Permitted for query/read hooks; mutations must never invoke repository methods directly.
- **Single ownership.** Every business capability (including UI, dialogs, hooks, query keys, and feature types) has one owning feature.
- **Feature-Root Barrels Prohibited (ADR-010).** Features do not expose root `index.ts` boundary barrels; cross-feature consumption uses approved direct module paths listed in `src/features/AGENTS.md`. Domain and application layers may expose stable module barrels where actively consumed by composition roots or features.
- **Domain-specific code stays in features.** `shared/` contains only domain-agnostic UI primitives, composites, and infrastructure utilities.
- Features organize capability code into components/, hooks/, types/, styles/, and utilities as needed; persistence and application services belong outside feature modules.
- Study content assets (markdown, figures) live in `content/materials/{documentId}/` — not inside feature directories
- Feature orchestrator: `{Feature}Screen.tsx` — wires hooks to views
- Workspace-embedded screens (ReaderScreen, QuizScreen `embedded`, QuizManagementScreen, FlashcardScreen) render bare content — the MaterialWorkspace provides the Page shell, title, and tab bar. Navigation is handled by AppSidebar + tabs, not by per-screen buttons.
- Feature view: `{Feature}View.tsx` — pure presentation
- Query hooks are separated from mutation hooks. Mutations live in `hooks/mutations/`; subject and term queries live in `hooks/queries/`.
- UI components contain 0 async data-fetching logic and 0 direct imports of TanStack Query or concrete storage classes. Mutation hooks delegate workflows to `src/application/` use cases (e.g. `useFlashcardRating` delegates to `RecordFlashcardReviewUseCase`, catalog subject/term mutation hooks delegate to `CreateSubjectUseCase`/`UpdateSubjectUseCase`/`ReorderSubjectsUseCase`/`CreateTermUseCase`/`UpdateTermUseCase`).
- Subject term UI: `SubjectTermList` is strictly presentational (props `{ terms, onReorder, onRemove }` — zero fetching/mutations/modals); `SubjectTermsTab` is the container owning term queries and mutations and rendering the add-existing/create/unlink modals. Modal open-state for add-existing/create is lifted to `SubjectWorkspace` (controlled props `showAddExisting`/`showCreate` + open/close callbacks) so the Page header hosts tab-specific actions. `useSubjectTermMutations` provides add/remove/reorder (optimistic) and create-and-assign hooks targeting `['subject', 'terms', subjectId]` query keys.
- Feature-owned cache namespaces: `catalogQueryKeys` owns material, subject, and term queries; `assessmentQueryKeys` owns quiz queries; `flashcardQueryKeys` owns flashcard review queries; `analyticsQueryKeys` owns analytics dashboard queries (`['analytics']`).
- `catalog/available/` owns discovery of canonical (D1) materials and the remote → local import lifecycle; `catalog/materials/` owns the local material lifecycle and editing/management. `available` reads local library state (`useLibrary`) for import status and invalidates the shared `catalogQueryKeys` namespaces on import/remove — runtime coupling, not ownership.
- `catalog/` internals: screens and sub-capabilities live under `available/components`, `materials/components`, `subjects/components`, `terms/components`; modals under `*/modals`; hooks under `*/hooks` with `queries/` and `mutations/` subdirectories. `catalog/shared/` holds catalog-internal helpers (`library.stylex` styles and related). These internal paths are private — outside consumers import only the direct paths listed under no-barrel-import below.
- Quiz hooks live under `quiz/hooks/`: `queries/`, `session/`, and `repositories/` subfolders; `quiz/hooks/index.ts` re-exports the consumed hook set.
- Accepted cycle: `catalog` screens embed `quiz` tree capabilities (`SubjectQuizTab` → quiz tree hooks + `QuizLaunchRequest`) while `quiz/hooks/queries/useSubjectQuizTree` consumes catalog data hooks — call-time-only (no module-init-time side effects may be added to any module in the cycle). The cross-feature edges of this cycle use the direct paths listed in the no-barrel-import contract below.
- **react-doctor `no-barrel-import` — resolved project-wide (Aug 2026), now codified in [ADR-010](../../docs/architecture/adr/ADR-010-replace-barrel-based-feature-boundaries.md).** Per user direction, every barrel import the rule flagged was converted to a direct module path (shared-UI sub-barrels like `shared/ui/Button`/`Input`/`Card`/`Dialog`/`Page`, `shared/hooks`, `shared/constants`, `app/providers`, `domain/quiz` badge appearances, and the cross-feature barrels below). `react-doctor --verbose` reports zero occurrences; do not re-introduce barrel imports for these symbols. Feature-root barrels were deleted in the Aug 2026 sweep — new cross-feature imports must follow the direct-path pattern and extend the allow-list below.
  - **Cross-feature direct paths (user-directed, Aug 2026) — the complete list:** `AppShell` → `quiz/QuizScreen` (default), `quiz/types/quizFeature.types` (`QuizLaunchRequest`), `quiz-management/canvas/QuizCanvasBuilder`, `shared/constants/storageKeys`, `app/providers/FocusModeContext`, `catalog/available/components/AvailableMaterialsScreen`, `catalog/available/components/PreviewMaterialScreen`; `ShellRoutes` → `features/analytics/AnalyticsScreen`; `MaterialWorkspace` → `reader/ReaderScreen`, `reader/hooks/useDocument`, `writer/components/MaterialWriterTab`, `quiz/QuizScreen`, `quiz-management/QuizManagementScreen`, `flashcards/FlashcardScreen`, `ai/components/AiChatDrawer`, `ai/components/AiDrawerToggleButton`, `ai/lib/aiContextExtractor`; `AppSidebar` → `catalog/subjects/hooks/queries/useSubject`, `catalog/materials/hooks/queries/useMaterial`; `SubjectQuizTab` → `quiz/hooks/queries/useSubjectQuizTree`, `quiz/hooks/queries/useQuizTreeSelection`, `quiz/types/quizFeature.types`; `useSubjectQuizTree` → `catalog/materials/hooks/queries/useLibrary`, `catalog/terms/hooks/queries/useTerms`; `ReaderScreen` → `catalog/materials/hooks/queries/useMaterial`; `FlashcardScreen` → `quiz/hooks/queries/useQuestions`, `quiz/hooks/queries/useQuizzes`; `PreviewMaterialScreen` → `reader/components/MarkdownViewer` (read-only markdown renderer — the preview surface borrows only the presentational viewer, never reader hooks/state). Extend this list only when the doctor rule flags a new site. The list is maintained manually (no lint rule enforces it) — keep it in sync whenever cross-feature imports change.
  - **Barrel removal (ADR-010):** the barrels above — and feature/shared/app/domain barrels generally — had zero importers and were deleted in the Aug 2026 cleanup sweep (44 files, ~1,500 lines). `react-doctor` is now clean (100/100); if an unimported `index.ts` reappears, delete it rather than retain it.


## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run` — Vitest unit, transformer, fidelity, persistence, and state test execution.
- `npm run test:e2e` — Playwright real-browser acceptance test execution.
- `npm run build` — TypeScript (`tsc -b`) and Vite production bundle check.
- `npm run lint` — Oxlint static boundary and lint analysis.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/features/analytics/AGENTS.md` | `src/features/analytics/` | Analytics & Learning Insights feature — Study overview, retention, mastery, activity heatmap |
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
| `src/features/quiz-management/AGENTS.md` | `src/features/quiz-management/` | Quiz & question authoring — Question Bank, Quiz Catalog, editors, publishing |
| `src/features/writer/AGENTS.md` | `src/features/writer/` | Writer feature — standard Lexical WYSIWYG authoring, lossless Markdown transformation |

