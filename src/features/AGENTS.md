# src/features/ — Feature Modules

## Purpose

Feature-based modules, each containing bounded domain capabilities: components, hooks, assets, types, styles, and utilities. Features represent bounded capabilities and consume other features only through the approved direct module paths defined by ADR-010 and ADR-014.

## Ownership

| Feature | Status | Scope |
|---|---|---|
| `materials/` | ✅ Implemented | Local study material management — material entities, `MaterialCard` (tags, action menu), `MaterialGrid`, `LibraryView`, material CRUD modals (`CreateMaterialModal`, `EditMaterialModal`, `DeleteConfirmationModal`), and library queries (`useLibrary`, `useMaterial`, `useLibraryRepository`, `materialQueryKeys`). Pure leaf context with zero cross-feature dependencies. |
| `discovery/` | ✅ Implemented | Shares-only explore hub — Explore content with sorting and search (`useExploreContent`), public share discovery and 1-click cloning (`usePublicShares`, `useCloneShare`), and remove-imported mutation (`useRemoveImportedMaterial`). The remote catalog hook (`useAvailableCatalog`, `GET /api/catalog`) was removed in the Phase 5 catalog retirement. |
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, TOC, TanStack Query + DI repositories. |
| `quiz/` | ✅ Implemented | Assessment engine — question renderer (5 types), quiz player (`QuizScreen`/`QuizStartView`/`QuizView`/`QuizResultView`), semantic badge appearance palette (`quizBadgeAppearance`), session flow hooks (atomic evaluation & submission via `SubmitQuizSessionUseCase`, session abandonment via `AbandonQuizSessionUseCase`), material quiz query hooks, DI repositories. |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, Quiz Catalog builder, QuestionEditorRegistry (5 type editors), application use-case adapters, publish/archive workflows, Quiz Canvas subsystem. |
| `flashcards/` | ✅ Implemented | Spaced-repetition study mode — Card projection from Question, SM-2 scheduling, 3D flip card player, rating flow (`RecordFlashcardReviewUseCase`), `FlashcardReviewRepository` hooks. |
| `writer/` | ✅ Implemented | WYSIWYG authoring and study material editing engine built on Lexical standard nodes and lossless Markdown transformation (H1–H6, multi-level lists, GFM tables, images, blockquotes, horizontal rules). |
| `analytics/` | ✅ Implemented | Learning analytics & insights dashboard — Study overview KPIs, card maturity distribution, 7-day review load forecast, topic mastery, and 52-week activity calendar. |
| `ai/` | ✅ Implemented | AI Study Assistant & Content Generation — Streaming token hooks (`useAiStreamChat`), thread management (`useAiChatThread`), section-aware grounded context extraction (`extractSectionContext`), UI components (`AiChatDrawer`, `AiChatMessage`, etc.), and AI generators (`AiQuestionGeneratorDialog`, `AiFlashcardGeneratorDialog`). |
| `importer/` | ✅ Implemented | Content Importer — 5-step wizard workflow (selecting → extracting → review → details → completed), drag-and-drop file ingestion, hybrid PDF extraction + OCR, adaptive review with Lexical `WriterEditor` and `MarkdownViewer`. |
| `sync/` | ✅ Implemented | Cloud synchronization UX — Reactive status hook (`useSyncStatus`, `useConflictDrafts`), status presentation pill (`SyncStatusPill`), and interactive document conflict resolution modal (`ConflictDraftsModal`). |
| `package/` | ✅ Implemented | Study Package (.lcpack) import/export and cloud sharing landing capabilities — `useExportStudyPackage`, `useImportStudyPackage`, `StudyPackagePreviewModal`, workspace/deck export triggers. |
| `collections/` | 🚧 In progress (parallel ownership) | Playlist Collections — collection query/mutation hooks and cache keys (parallel owner), plus self-contained collection dialogs (`CreateCollectionModal`, `EditCollectionModal`, `ManageMaterialCollectionsModal`) for collection creation, editing, and material assignment. |
| `collections/` | ✅ Implemented | Playlist-model collections — membership queries (`useCollections`, `useCollection`, `useCollectionMaterials`, `useMaterialCollections`, `useUnassignedMaterials`), membership mutations (`useCreateCollection`, `useUpdateCollection`, `useDeleteCollection`, `useAddMaterialToCollection`, `useRemoveMaterialFromCollection`, `useReorderCollectionMaterials`), and `collectionQueryKeys`. Edit dialogs in `modals/` are parallel-owned (do not touch). |

## Local Contracts

- **Direct-path contracts only (ADR-010).** Cross-feature consumers import only the approved direct module paths listed under no-barrel-import below; internal feature paths are private.
- **Architectural Boundary Guardrails (Oxlint & Vitest):** Features must never import concrete infrastructure (`src/infrastructure/**`) or route-level screens (`src/app/screens/**`). Enforced statically via Oxlint `no-restricted-imports` and `src/__tests__/architecture/featureBoundary.test.ts`.
- **Dependency Flow Policy:**
  - `Features → Application`: Required for all write mutations and business workflows (`context.useCases.*`).
  - `Features → Domain`: Allowed for model types, value objects, and query contracts (`Question`, `StudyMaterial`, `ReviewState`).
  - `Features → Infrastructure`: Strictly forbidden.
  - `Features → Context Repositories`: Permitted for query/read hooks; mutations must never invoke repository methods directly.
- **Features represent bounded capabilities, not route screens (ADR-014).**
  - Features own domain capabilities, state hooks, queries, mutations, and feature-owned presentation components (e.g. `MaterialCard`, `ReaderView`, `MaterialGrid`).
  - Route-level page layouts, routing compositions, and cross-feature orchestrations belong exclusively to `src/app/screens/` (e.g. `LibraryHomeScreen`, `MaterialWorkspaceScreen`, `ExploreScreen`).
- **Directed Acyclic Graph (DAG) Dependency Model (ADR-014):**
  - Cross-feature dependencies have an intentional direction and must NEVER form cycles.
  - `materials` is a foundational leaf capability with zero dependencies on other features.
  - `reader` depends on `materials`.
  - `writer` depends on `reader` and `materials`.
  - `discovery` depends on `materials`.
  - `quiz` depends on `materials`.
  - `flashcards` depends on `quiz`, `reader`, and `materials`.
  - `quiz-management` depends on `quiz`, `reader`, `package`, `materials`, and `ai`.
  - `package` depends on `materials`.
  - `collections` depends unidirectionally on `materials` (membership resolution via the `LibraryRepository` port, `MaterialCard` presentation).
  - `ai` depends on `quiz` and never on `quiz-management`.
  - `analytics` and `sync` have zero feature-to-feature dependencies.
  - Enforced by `src/__tests__/architecture/featureBoundary.test.ts`.
- **Single ownership.** Every business capability (including UI, dialogs, hooks, query keys, and feature types) has one owning feature.
- **Feature-Root Barrels Prohibited (ADR-010).** Features do not expose root `index.ts` boundary barrels; cross-feature consumption uses approved direct module paths.
- **react-doctor `no-barrel-import` — resolved project-wide (Aug 2026), codified in [ADR-010](../../docs/architecture/adr/ADR-010-replace-barrel-based-feature-boundaries.md).**
  - **Cross-feature direct paths allow-list:**
    - `screens/library/*` → `features/materials/components/LibraryView`, `features/materials/modals/*`
    - `screens/material-workspace/*` → `features/materials/hooks/queries/useMaterial`, `features/reader/ReaderScreen`, `features/writer/components/MaterialWriterTab`, `features/quiz/QuizScreen`, `features/quiz-management/QuizManagementScreen`, `features/flashcards/FlashcardScreen`, `features/ai/components/AiChatDrawer`    - `screens/explore/*` → `features/discovery/hooks/useExploreContent`, `features/discovery/hooks/useCloneShare`
    - `writer/components/MaterialWriterTab` → `features/materials/hooks/queries/useMaterial`, `features/reader/hooks/useDocument`
    - `writer/hooks/useMaterialWriterState` → `features/materials/hooks/queries/useMaterial`, `features/reader/hooks/useDocument`
    - `reader/ReaderScreen` → `features/materials/hooks/queries/useMaterial`
    - `flashcards/FlashcardScreen` → `features/materials/hooks/queries/useMaterial`, `features/reader/hooks/useDocument`, `features/quiz/hooks/queries/useQuestions`, `features/quiz/hooks/queries/useQuizzes`, `features/ai/generator/components/AiFlashcardGeneratorDialog`
    - `quiz-management/components/QuestionBankTab` → `features/ai/generator/components/AiQuestionGeneratorDialog`, `features/quiz/utils/quizBadgeAppearance`
    - `ai/generator/components/GeneratedQuestionPreviewCard` → `features/quiz/utils/quizBadgeAppearance`
    - `discovery/hooks/mutations/useRemoveImportedMaterial` → `features/materials/hooks/useLibraryRepository`, `features/materials/queries/materialQueryKeys`
    - `discovery/hooks/useCloneShare` → `features/materials/queries/materialQueryKeys`
    - `discovery/hooks/useExploreContent` → `features/materials/hooks/queries/useLibrary`
    - `screens/collection-workspace/*` → `features/collections/hooks/queries/useCollection`, `features/collections/hooks/queries/useCollectionMaterials`, `features/collections/hooks/mutations/useUpdateCollection`, `features/collections/hooks/mutations/useRemoveMaterialFromCollection`, `features/collections/hooks/mutations/useDeleteCollection`, `features/collections/modals/EditCollectionModal`, `features/materials/components/MaterialCard`
    - `layouts/desktop-sidebar` → `features/collections/hooks/queries/useCollections`, `features/collections/hooks/mutations/useCreateCollection`, `features/collections/modals/CreateCollectionModal`, `features/collections/modals/collectionAppearance`

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
| `src/features/materials/AGENTS.md` | `src/features/materials/` | Study Materials — local library management, material cards, material CRUD dialogs |
| `src/features/discovery/AGENTS.md` | `src/features/discovery/` | Content Discovery — remote catalog exploration, public share cloning, shares-only Explore hub |
| `src/features/quiz/AGENTS.md` | `src/features/quiz/` | Quiz Assessment Engine — live session runner, question renderer, session state machine |
| `src/features/flashcards/AGENTS.md` | `src/features/flashcards/` | Spaced-Repetition Study — SM-2 scheduling, card projection, 3D flip card player |
| `src/features/analytics/AGENTS.md` | `src/features/analytics/` | Analytics & Learning Insights feature — Study overview, retention, mastery, activity heatmap |
| `src/features/ai/AGENTS.md` | `src/features/ai/` | AI Study Assistant & Content Generation — Chat drawer, grounded context, generator dialogs |
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
| `src/features/importer/AGENTS.md` | `src/features/importer/` | Content Importer feature — 5-step wizard, PDF & OCR extraction, Lexical review |
| `src/features/quiz-management/AGENTS.md` | `src/features/quiz-management/` | Quiz & question authoring — Question Bank, Quiz Catalog, editors, publishing |
| `src/features/writer/AGENTS.md` | `src/features/writer/` | Writer feature — standard Lexical WYSIWYG authoring, lossless Markdown transformation |
| `src/features/sync/AGENTS.md` | `src/features/sync/` | Cloud Synchronization UX — Status pill, conflict resolution modal, reactive synchronization hooks |
| `src/features/package/AGENTS.md` | `src/features/package/` | Study Package feature — .lcpack export & import hooks, package inspection & preview modal |
| `src/features/collections/AGENTS.md` | `src/features/collections/` | Playlist Collections — collection hooks/queries (parallel owner) and self-contained collection dialogs |
| `src/features/collections/AGENTS.md` | `src/features/collections/` | Playlist Collections — membership queries/mutations, collection query keys |
