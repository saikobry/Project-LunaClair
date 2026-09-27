# src/features/ — Feature Modules

## Purpose

Feature-based modules, each containing bounded domain capabilities: components, hooks, assets, types, styles, and utilities. Features represent bounded capabilities and consume other features only through the approved direct module paths defined by ADR-010 and ADR-014.

## Ownership

| Feature | Status | Scope |
|---|---|---|
| `materials/` | ✅ Implemented | Local study material management — material entities, `MaterialCard` (tags, action menu), `MaterialGrid`, `LibraryView`, material CRUD modals (`CreateMaterialModal`, `EditMaterialModal`, `RemoveMaterialModal`), and library queries (`useLibrary`, `useMaterial`, `useLibraryRepository`, `materialQueryKeys`). Pure leaf context with zero cross-feature dependencies. |
| `discovery/` | ✅ Implemented | Shares-only explore hub — Explore content with sorting and search (`useExploreContent`), public share discovery and 1-click cloning (`usePublicShares`, `useCloneShare`). The remote catalog hook (`useAvailableCatalog`, `GET /api/catalog`) was removed in the Phase 5 catalog retirement. |
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, TOC, TanStack Query + DI repositories. |
| `quiz/` | ✅ Implemented | Assessment engine — question renderer (5 types), quiz player (`QuizScreen`/`QuizStartView`/`QuizView`/`QuizResultView`), semantic badge appearance palette (`quizBadgeAppearance` — per-hue `--color-badge-*` token references, with the literals confined to the theme), session flow hooks (atomic evaluation & submission via `SubmitQuizSessionUseCase`, session abandonment via `AbandonQuizSessionUseCase`), material quiz query hooks, DI repositories. |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, Quiz Catalog builder, QuestionEditorRegistry (5 type editors over the shared `ChoiceListRow`), application use-case adapters, publish/archive workflows, Quiz Canvas subsystem. |
| `flashcards/` | ✅ Implemented | Spaced-repetition study mode — Card projection from Question (1:1 for non-cloze types, 1 per blank for `fill_in_blank` so each blank gets its own SM-2 schedule), SM-2 scheduling, 3D flip card player, rating flow (`RecordFlashcardReviewUseCase`), `FlashcardReviewRepository` hooks. |
| `writer/` | ✅ Implemented | WYSIWYG authoring and study material editing engine built on Lexical standard nodes and lossless Markdown transformation (H1–H6, multi-level lists, GFM tables, images, blockquotes, horizontal rules). |
| `analytics/` | ✅ Implemented | Learning analytics & insights dashboard — Study overview KPIs, card maturity distribution over the **projected card pool** (a card, not a question; orphaned schedules reported as a footnote, never absorbed), 7-day review load forecast, topic mastery, and 52-week activity calendar. Zero feature-to-feature dependencies. |
| `ai/` | ✅ Implemented | AI Study Assistant & Content Generation — Per-material conversation sessions with history (`useAiChatThread`, `AiChatHistoryPanel`), live in-transcript wait/stall feedback (`aiActivity`, `AiStreamingIndicator`), section-aware grounded context extraction (`extractSectionContext`), per-request model selection over a **shared** catalog query (`useAiModelCatalog`, `useAiModelSelection`, `AiModelPicker`, `aiQueryKeys`), UI components (`AiChatDrawer`, `AiChatMessage`, etc.), and AI generators (`AiQuestionGeneratorDialog`, `AiFlashcardGeneratorDialog` — model-aware synthesis resolved from `materialId`, no caller-supplied document; both rendered through the shared controlled `AiBatchGeneratorShell`). No user-facing tutor-mode selector. |
| `importer/` | ✅ Implemented | Content Importer — 5-step wizard workflow (selecting → extracting → review → details → completed), drag-and-drop file ingestion, hybrid PDF extraction + OCR, adaptive review with Lexical `WriterEditor` and `MarkdownViewer`. |
| `sync/` | ✅ Implemented | Cloud synchronization UX — Reactive status hook (`useSyncStatus`, `useConflictDrafts`), status presentation pill (`SyncStatusPill`), and interactive document conflict resolution modal (`ConflictDraftsModal`). |
| `package/` | ✅ Implemented | Study Package (.lcpack) import/export and cloud sharing landing capabilities — `useExportStudyPackage`, `useImportStudyPackage`, `StudyPackagePreviewModal`, workspace/deck export triggers. |
| `collections/` | ✅ Implemented | Playlist-model collections — membership queries (`useCollections`, `useCollection`, `useCollectionMaterials`, `useMaterialCollections`, `useAssignedMaterialIds`), membership mutations (`useCreateCollection`, `useUpdateCollection`, `useDeleteCollection`, `useAddMaterialToCollection`, `useRemoveMaterialFromCollection`, `useReorderCollectionMaterials`), `collectionQueryKeys`, and the Library `CollectionShelf` presentation component. Dialogs in `modals/` are parallel-owned (do not touch). |

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
  - Route-level page layouts, routing compositions, and cross-feature orchestrations belong exclusively to `src/app/screens/` (e.g. `HomeScreen`, `LibraryScreen`, `MaterialWorkspaceScreen`, `ExploreScreen`).
- **Directed Acyclic Graph (DAG) Dependency Model (ADR-014):**
  - Cross-feature dependencies have an intentional direction and must NEVER form cycles.
  - `materials` consumes `collections` (`MaterialCard`'s filing popover — the sole material-to-collection assignment surface). Verified Sep 2026: the edge is one-way and `collections` imports nothing from `materials`, so the DAG stays acyclic. The earlier "zero dependencies" wording did not match the code.
  - `reader` depends on `materials`.
  - `writer` depends on `reader` and `materials`.
  - `discovery` depends on `materials`.
  - `quiz` depends on `materials`.
  - `flashcards` depends on `quiz`, `reader`, and `materials`.
  - `quiz-management` depends on `quiz`, `reader`, `package`, `materials`, and `ai`.
  - `package` depends on `materials`.
  - `collections` has **no feature dependencies**. Membership reads go through the `LibraryRepository` **domain** port, not the `materials` feature. It carries a type-only dependency on `quiz` (`QuizLaunchRequest` launch contract for `CollectionQuizExplorer`; no runtime quiz imports).
  - `ai` depends on `quiz` and never on `quiz-management`.
  - `importer` depends on `writer`, `reader`, and `ai`.
  - `analytics` and `sync` have zero feature-to-feature dependencies. `analytics` in particular must stay that way: a question write changes the analytics card pool, and that invalidation is coordinated at the **app composition root** (`src/app/bootstrap/analyticsInvalidation.ts`) rather than from `quiz-management`, precisely so no `quiz-management -> analytics` edge is needed. Do not add it, and do not import another feature's query key to express "my write changed your data".
  - Enforced by `src/__tests__/architecture/featureBoundary.test.ts`.
- **Single ownership.** Every business capability (including UI, dialogs, hooks, query keys, and feature types) has one owning feature.
- **Question-type vocabulary is owned by the domain (ADR-010 direction).** `domain/quiz/models/questionMetadata` holds the ordered `QUESTION_TYPES`, the canonical `QUESTION_TYPE_LABELS`, and `VALID_QUESTION_TYPES`; features and screens (generator dialog, editor registry, bank filters, package formatting, package validation) consume it instead of a local label list or type `Set`, so a sixth type cannot drift a spelling. The one presentation-side binding is the hue palette (`features/quiz/utils/quizBadgeAppearance.ts`), which binds colours — never names — to a type.
- **Feature-Root Barrels Prohibited (ADR-010).** Features do not expose root `index.ts` boundary barrels; cross-feature consumption uses approved direct module paths.
- **react-doctor `no-barrel-import` — resolved project-wide (Aug 2026), codified in [ADR-010](../../docs/architecture/adr/ADR-010-replace-barrel-based-feature-boundaries.md).**
  - **Cross-feature direct paths allow-list:**
    - `screens/home/*` → `features/materials/hooks/queries/useLibrary`, `features/materials/modals/CreateMaterialModal`, `features/analytics/hooks/queries/useGlobalAnalytics`
    - `screens/library/*` → `features/materials/components/LibraryView`, `features/materials/modals/*`, `features/materials/hooks/queries/useLibrary`, `features/materials/hooks/mutations/*`, `features/materials/types/libraryFilter.types`, `features/collections/components/CollectionShelf`, `features/collections/hooks/queries/useAssignedMaterialIds`, `features/collections/hooks/queries/useCollections`, `features/collections/hooks/queries/useCollectionMaterialCounts`, `features/collections/hooks/mutations/useCreateCollection`, `features/collections/modals/CreateCollectionModal`
    - `screens/material-workspace/*` → `features/materials/hooks/queries/useMaterial`, `features/collections/hooks/queries/useCollection` (resolves the `?from=` origin collection for the breadcrumb), `features/reader/ReaderScreen`, `features/reader/hooks/useDocument`, `features/reader/hooks/useMaterialAssets`, `features/reader/hooks/useAssetRepository`, `features/reader/queries/readerQueryKeys` (shared asset-cache key for the Attachments/Source surfaces), `features/writer/components/MaterialWriterTab`, `features/quiz/QuizScreen`, `features/quiz-management/QuizManagementScreen`, `features/flashcards/FlashcardScreen`, `features/ai/components/AiChatDrawer`, `features/ai/components/AiDrawerToggleButton`, `features/package/hooks/useExportStudyPackage`, `features/package/hooks/useStudyPackageSize` (share-budget meter), `features/package/components/ShareStudyPackageModal`
    - `screens/explore/*` → `features/discovery/hooks/useExploreContent`, `features/discovery/hooks/useCloneShare`
    - `screens/shared-package/*` → `features/discovery/hooks/useLocalOriginMaterials` (exact clone identity for the share landing surface: recognises a share cloned in an earlier session instead of offering a duplicate clone), `features/package/components/PackageStatsGrid`, `features/package/components/QuestionTypeBreakdown`, `features/package/utils/packageFormat` (package stats/type-breakdown delegated to the package feature; never `shared/ui`)
    - `writer/components/MaterialWriterTab` → `features/materials/hooks/queries/useMaterial`, `features/reader/hooks/useDocument`
    - `writer/hooks/useMaterialWriterState` → `features/materials/hooks/queries/useMaterial`, `features/reader/hooks/useDocument`
    - `reader/ReaderScreen` → `features/materials/hooks/queries/useMaterial`
    - `flashcards/FlashcardScreen` → `features/materials/hooks/queries/useMaterial`, `features/quiz/hooks/queries/useQuestions`, `features/quiz/hooks/queries/useQuizzes`, `features/ai/generator/components/AiFlashcardGeneratorDialog`
    - `quiz-management/components/QuestionBankTab` → `features/ai/generator/components/AiQuestionGeneratorDialog`, `features/quiz/utils/quizBadgeAppearance`
    - `ai/generator/components/GeneratedQuestionPreviewCard` → `features/quiz/utils/quizBadgeAppearance`
    - `discovery/hooks/useCloneShare` → `features/materials/queries/materialQueryKeys`
    - `discovery/hooks/useLocalOriginMaterials` → `features/materials/hooks/queries/useLibrary`
    - `screens/collection-workspace/*` → `features/collections/hooks/queries/useCollection`, `features/collections/hooks/queries/useCollectionMaterials`, `features/collections/hooks/queries/useCollectionMaterialCounts`, `features/collections/hooks/queries/useCollectionQuizTree`, `features/collections/components/CollectionQuizExplorer`, `features/collections/types/collectionQuizTree.types`, `features/collections/hooks/mutations/useUpdateCollection`, `features/collections/hooks/mutations/useRemoveMaterialFromCollection`, `features/collections/hooks/mutations/useDeleteCollection`, `features/collections/modals/EditCollectionModal`, `features/collections/modals/collectionAppearance`, `features/materials/components/MaterialCard`, `features/quiz/types/quizFeature.types`
    - `layouts/desktop-sidebar` → `features/collections/hooks/queries/useCollections`, `features/collections/hooks/queries/useCollectionMaterialCounts`, `features/collections/hooks/mutations/useCreateCollection`, `features/collections/modals/CreateCollectionModal`, `features/collections/components/CollectionNavItem` (sidebar rows delegate to the feature-owned nav row; layout styles never flow into features)
    - `layouts/navigation/*` → `features/collections/hooks/queries/useCollections`, `features/collections/hooks/queries/useCollectionMaterialCounts`, `features/collections/hooks/mutations/useCreateCollection`, `features/collections/modals/CreateCollectionModal`, `features/collections/components/CollectionNavItem` (rail + drawer rows delegate to the feature-owned nav row; layout styles never flow into features)
    - `importer/components/ImportReviewView` → `features/ai/hooks/useAiModelSelection`, `features/ai/components/AiModelPicker`, `features/writer/components/WriterEditor`, `features/reader/components/MarkdownViewer`
    - `screens/settings/*` → `features/ai/components/AiSettingsSection`

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
| `src/features/collections/AGENTS.md` | `src/features/collections/` | Playlist Collections — membership queries/mutations, collection query keys, CollectionShelf |
