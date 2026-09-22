# LunaClair Roadmap

**Studio:** Saiko Interactive  
**Project:** LunaClair — Interactive AI Learning Platform  

---

## Completed Phases

- ✅ **Phase 1 — Foundation & Application Architecture**
  - Application shell layout, StyleX design tokens, React 19 + TypeScript + Vite setup.
- ✅ **Phase 2 — Repository & Dependency Injection**
  - Domain-level repository ports, React Context dependency injection (`RepositoryProvider`), and TanStack Query integration.
- ✅ **Phase 3 — Reader Domain Modernization**
  - Highlight and drawing persistence, per-document annotation keying, optimistic mutation hooks.
- ✅ **Phase 4 — Content Asset Pipeline**
  - Decoupled document resolution, markdown content delivery, and figure preprocessing.
- ✅ **Phase 4.1 — Reader Architecture Cleanup**
  - Removal of legacy in-memory content registries and standardization of storage namespaces.
- ✅ **Phase 5 — Assessment Engine Foundation**
  - Dexie IndexedDB database (`lunaclair-db`), strategy-based answer grading (`QuestionStrategyResolver`), pure `AssessmentService`, immutable `questionSnapshots` in `QuizSession`, multi-question type support (`multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`), and centralized `QuestionRenderer`.
- ✅ **Phase 5.1 — Assessment Experience Integration**
  - Lightweight `AppRoute` navigation, "Start Quiz" entry points in Library and Reader screens, `QuizScreen` state machine, interactive `QuizView` player, post-session `QuizResultView`, modular session sub-hooks, and atomic session persistence.
- ✅ **Phase 5.2 — Quiz & Question Management**
  - Dedicated authoring feature module (`src/features/quiz-management/`), full-screen management interface (`QuizManagementScreen`), Question Bank tab, Quiz Catalog tab, dynamic `QuestionEditorRegistry` for 5 question types, `QuizBuilderDialog` with version pinning, publishing status workflows (`draft` / `published` / `archived`), and soft-deletion archiving.
- ✅ **Phase 6 — Application Layer & Domain Boundary Refinement**
  - Added framework-agnostic application use cases, a composition root, direct use-case mutation adapters, atomic quiz session submission, and application-owned material/subject-term validation.
- ✅ **Phase 6.1 — Flashcards & Spaced Repetition**
  - Spaced-repetition flashcards derived dynamically from existing question bank via `questionToCard`, pure SM-2 scheduler (`review`, `isDue`), `FlashcardReviewRepository` with v5 IndexedDB schema (`flashcardReviews`), 3D flip card player, rating flow, and embedded Flashcards tab in `MaterialWorkspace`.
- ✅ **Phase 6.2 — LunaClair Writer & Markdown Fidelity Stabilization**
  - Standard Lexical WYSIWYG authoring engine with lossless bidirectional Markdown transformations (headings H1–H6, paragraphs, inline styles, multi-level nested lists, GFM tables, images, blockquotes, horizontal rules).
  - Embedded `MaterialWriterTab` in `MaterialWorkspace` with Save/Discard/Copy/Export actions, active dirty state tracking, and unsaved material-switch modal protection.
  - Local document markdown persistence via Dexie's `documentContents` store (Dexie schema v6/v8) and `HybridDocumentRepository` fallback.
  - Three-layer testing suite: 76 Vitest tests (unit, transformer, fidelity, Dexie persistence, and UI state) + 10 Playwright real-browser E2E acceptance tests.
- ✅ **Phase 7 — Analytics & Learning Insights**
  - Pure domain analytics calculation engines operating deterministically on canonical learning data (`quizSessions` and `flashcardReviews`) with zero side effects.
  - Question-weighted accuracy (`totalCorrect / totalAnswered * 100`), consecutive streak with today/yesterday grace logic and historical max, mutually exclusive card maturity partition (`newCount + learningCount + reviewCount + masteredCount === totalCards`), and 7-day review forecast with overdue collapsing.
  - Topic and subject mastery matrices with difficulty multipliers ($1.0, 1.5, 2.0$), attempt counting, and deterministic strengths/weaknesses ranking ($\ge 85\%$, $\ge 3$ attempts).
  - Application orchestration: `AnalyticsRepository` port, `DexieAnalyticsRepository` using concurrent indexed queries (`Promise.all`), and application use cases (`GetGlobalAnalyticsUseCase`, `GetSubjectAnalyticsUseCase`, `GetMaterialAnalyticsUseCase`).
  - Presentation hub: `/analytics` screen (`Insights` in sidebar), 4 KPI overview cards, card maturity segmented distribution, lightweight SVG review forecast chart, subject mastery matrix, and 52-week activity heatmap with semantically honest labels.
  - Automatic cache invalidation on quiz session completion and flashcard reviews.
  - Comprehensive verification: 21 Vitest test files (138 tests, 100% passing) + 10 Playwright E2E tests.

## Additional shipped capabilities (not separately phased)

These capabilities were delivered alongside Phases 6.1/6.2/7 and are documented here:

- ✅ **Catalog-first library:** D1-delivered catalog discovery, explicit material import/removal, authoritative per-material resolution, and read-only previews.
- ✅ **Application shell hardening:** MiniToc responsive outline overlay with scroll-spy, Quiz canvas crash-recovery drafts, URL-addressable workspace routes, Focus Mode, and first-run onboarding.
- ✅ **Architecture enforcement:** ADR-010 direct-path feature contracts, feature ownership cleanup, and static import-boundary guardrails.

---

## Offline Readiness (Implemented — Aug 2026)

LunaClair is installable and offline-capable. Offline readiness is separate from cloud synchronization:

- ✅ **PWA foundation:** `vite-plugin-pwa` provides the app-shell service worker, web manifest, and generated install icons. Registration and manifest injection are handled by the build.
- ✅ **Content delivery caching:** canonical study materials live under `content/materials/`, are seeded into Cloudflare D1, served by the API Worker, and cached on demand by the service worker. Imported document markdown is persisted locally in Dexie's `documentContents` store.
- ✅ **Offline UX:** `OfflineBanner` communicates connectivity, and TanStack Query uses `networkMode: 'offlineFirst'` so IndexedDB-backed queries and mutations continue while disconnected.
- ✅ **Install discovery:** an opt-in sidebar install entry and a one-time iOS-specific install card are available without deferred `beforeinstallprompt` machinery.
- ✅ **First-run onboarding:** a bundled, skippable tutorial syncs the default academic terms into local state when dismissed or completed.

Offline-ready ≠ offline-sync: synchronization (sync queue, conflict resolution) stays **Phase 10 — Cloud Synchronization** scope.

---

- ✅ **Phase 8 — AI Study Assistant & Content Generation**
  - **8A (AI Infrastructure & Streaming):** Cloudflare Workers AI bridge (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), line-buffered SSE chunk streaming, provider-agnostic `AiService` port, `WorkerAiAdapter`, and `useAiStreamChat` token hook.
  - **8B (Grounded Context & Tutor Modes):** Section-aware context extractor (`extractSectionContext`), multi-mode prompts (`assistant`, `socratic`, `summarizer`), and active text selection contextual actions ("Explain", "Simplify", "Example").
  - **8C (Thread Persistence & Workspace Drawer):** Persistent conversation threads and messages in IndexedDB (Dexie v9 `aiThreads`/`aiMessages`, `DexieAiChatRepository`), orphan message cleanup, interrupted stream recovery, and workspace-level drawer integration (`MaterialWorkspace` → `AiChatDrawer`).
  - **8D (AI Content Synthesis — Questions & Flashcards):** Structured generation port (`generateStructured`) with single-pass JSON repair, canonical question schema validators across 5 quiz types, atomic batch persistence (`QuestionRepository.createQuestionsBatch`) in default `draft` status, interactive `AiQuestionGeneratorDialog` in Question Bank, and dedicated `AiFlashcardGeneratorDialog` with front/back flashcard cards in FlashcardScreen.

- ✅ **Phase 9 — Content Importer**
  - **9A (Domain Contracts & Pipeline):** Provider-agnostic `ContentImporter` port, `ImporterRegistry` format resolution, `ExtractionOptions` (signal, progress, password, language), `ImportAssetRepository` port, domain types (`ImportSession`, `ImportCandidate`, `ExtractionResult`, `PageExtraction`, `ImportMetadata`, `ImportError`), and a 6-pass pure Markdown conversion pipeline (normalization → structure → page anchors → lists → tables → cleanup).
  - **9B (Infrastructure Adapters & Storage):** `PdfjsImporter` with sequential page memory management, density scoring heuristic for OCR delegation, and password exception recovery; `TesseractExtractor` with lazy worker pool and grayscale/EXIF preprocessing; `ImageImporter` and `DefaultImporterRegistry`; Dexie v10 schema adding the `importAssets` store (`materialId`, `blob`, `mimeType`, `filename`, `importedAt`) and `DexieImportAssetRepository`.
  - **9C (Application Orchestration):** `ExtractContentUseCase` connecting importers to the Markdown pipeline; `CommitImportUseCase` atomically persisting `StudyMaterial`, `ImportedDocumentContent`, and `ImportedAsset`; `CleanupImportWithAiUseCase` providing opt-in structured AI cleanup with original/cleaned diff generation.
  - **9D (Feature UI & 5-Step Wizard):** `ImporterScreen` 5-step wizard (`selecting` → `extracting` → `review` → `details` → `completed`), drag-and-drop file ingestion (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.jfif`, `.heic`, `.heif`, `.webp`), bounded concurrent extraction queue (max 2 parallel jobs), adaptive dual-pane review layout embedding Lexical `WriterEditor` and `MarkdownViewer` with per-page confidence badges, opt-in AI cleanup with model selection and inline diff comparison modal in `ImportReviewView`, title/subject/term assignment, password unlock dialog, and completion summary with workspace navigation.
  - **9E (Shell Integration & Code-Splitting):** URL-addressable `/import` route lazy-loaded via `React.lazy` to keep the initial application bundle lean, sidebar navigation entry with `FileUp` icon, comprehensive unit test coverage (40 test files, 224 passing unit tests), and full Playwright real-browser acceptance test suite (14 passing E2E tests).
  - **9F (Multimodal Vision Document Extraction):** Native multimodal document extraction using MAX (`ukisai-swift-max`) to transform scanned PDFs and image notes directly into structured Markdown tables and formatting; `supportsVision` capability routing and validation (< 3MB, single-page data URLs); local-first offline invariant retaining Tesseract WASM as default; 12s pacing and abortable 429 rate-limit cooldown; and cancellation-safe partial extraction preserving processed pages with review warning banner.

---

- ✅ **Phase 10 — Cloud Synchronization**
  - **10A (Domain Primitives & Types):** Pure sync domain types (`SyncEntityType`, `SyncOperation`, `EntityVersion`, `SyncCursor`, `SessionCredentials`, `SyncMutation`, `SyncQueueItem`, `SyncState`, `ConflictDraft`), typed `SyncPayloadMap`, domain comparators (`evaluateDocumentConcurrency`, `compareLwwTimestamps`, `compareFlashcardReviews`), soft-delete tombstones (`deletedAt`), and domain repository ports.
  - **10B (Dexie Schema v11 & Transactional Outbox):** Additive Dexie v11 schema (`syncQueue`, `syncState`, `conflictDrafts`), table typings in `LunaClairDatabase`, `runSyncableTransaction` helper for atomic entity write + outbox record creation, and Dexie repository implementations (`DexieSyncQueueRepository`, `DexieSyncStateRepository`, `DexieConflictDraftRepository`).
  - **10C (D1 Cloud Replica & Schema):** 4-table hybrid replication schema in `worker/src/schema.ts` (`user_documents` versioned, `user_entities` opaque JSON LWW/append, `sync_changes` global sequence journal, `sync_idempotency` dedup ledger) and versioned D1 migration (`20260827080605_furry_molly_hayes`).
  - **10D (Worker Sync Protocol):** `POST /api/sync/push` with single SQL atomic CAS versioning for documents, LWW recency check, append-only ingestion for quiz sessions, exact-once idempotency ledger, and `GET /api/sync/pull` with global sequence delta querying and batch entity hydration.
  - **10E (Client Sync Engine & Transport):** `SyncTransport` port, `WorkerSyncTransport` adapter with runtime validation and typed error hierarchy (`SyncNetworkError`, `SyncHttpError`, `SyncProtocolError`), exponential backoff retry policy, and framework-agnostic single-flight `SyncEngine` orchestrating the 4-step convergence cycle (`pullUntilCaughtUp` → `reconcile` → `pushPendingBatches` → `pullUntilCaughtUp`).
  - **10F (Client Reconcilers & Conflict Handlers):** Specialized domain reconcilers (`DocumentReconciler`, `TimestampLwwReconciler`, `FlashcardReviewReconciler`, `QuizSessionReconciler`) and atomic multi-table `DexieSyncReconciler` (`reconcilePullBatch` & `applyPushResult`).
  - **10G (Session & Identity Plumbing):** Authoritative Bearer token user identity derivation on Worker, `SessionCredentialsProvider` port, `LocalStorageCredentialsProvider` with stable device ID management (`getOrCreateDeviceId`), and application sync use cases (`ResolveConflictDraftUseCase`, `TriggerSyncUseCase`, `GetSyncStatusUseCase`, `GetConflictDraftsUseCase`).
  - **10H (Sync UX & Presentation):** Reactive `useSyncStatus` and `useConflictDrafts` hooks, accessible `SyncStatusPill` with visual indicators in `AppSidebar`, and interactive `ConflictDraftsModal` for student conflict review and resolution (`keep_server`, `keep_local`, `merge`).

---

- ✅ **Phase 11 — Collaboration & Sharing**
  - **11A (Study Package Domain & Specification):** Portable `.lcpack` JSON bundle format (Schema v1), SHA-256 integrity verification, ID prefix namespaces (`pkg_mat_*`, `pkg_q_*`, `pkg_quiz_*`, `pkg_card_*`, `pkg_asset_*`), pure structural and referential validator (`validateStudyPackage`), collision-free relational UUID remapper (`remapStudyPackage`), and pure metrics inspector (`inspectStudyPackage`).
  - **11B (Package Import/Export UI & Staging):** Export triggers across `MaterialWorkspace`, `FlashcardScreen`, and `QuizManagementScreen`; `useExportStudyPackage` browser downloader; pre-import inspection dialog (`StudyPackagePreviewModal`) with question type breakdown, point totals, and destination Subject/Term pickers; file ingestion integration in `ImporterScreen`.
  - **11C (Cloudflare D1 Sharing Infrastructure):** D1 `share_links` and `share_stats` replication schema, Worker REST API endpoints (`/api/shares`, `/api/shares/:id`, `/api/shares/short/:code`, `/api/shares/public`, `/api/shares/:id/track-download`), access control models (`public`, `unlisted`, `passcode` with salted PBKDF2/SHA-256 hashing), and optional expiration dates.
  - **11D (Cloud Share UI & Landing Screen):** Publishing dialog (`ShareStudyPackageModal`) with access configuration and link copy; standalone landing screen (`SharedPackageScreen` for `/share/:id` and `/s/:code`) with passcode unlock modal, package metrics preview, 1-click **Clone to Library**, and `.lcpack` export downloading with telemetry tracking.
  - **11E (Unified Explore Hub):** Consolidated discovery surface (`/explore`, `ExploreScreen`) merging official curriculum coursework with community study packages, featuring source filters (`[ All | Official | Community ]`), debounced search, popular/recent sorting, and 1-click library cloning.

- ✅ **Phase 12 — Responsive Shell Experience & Architectural Hardening**
  - **12A (Adaptive Navigation & Shell Experience):**
    - Viewport-specific navigation architecture: `DesktopSidebar` with Option A $240\times58\text{px}$ rounded trapezoid Focus Mode drawer continuously morphing into a $44\times44\text{px}$ restore pill with independent link fade; `TabletRail` (60px floating vertical icon rail with height-collapsing animations); `MobileBottomDock` (60px floating bottom pill with safe-area inset support and slide-down focus transitions).
    - Scroll-depth reactive `AppHeader`: dynamic hysteric scroll detection (`useHeaderScroll`) collapsing into floating frosted glass action capsules with compact brand icon, PWA install affordance, and `SyncStatusPill`.
    - Shell layout modularization: structured `src/app/` into `layouts/`, `navigation/`, `routing/`, `overlays/`, and `screens/`.
    - StyleX standardization: normalized all extracted stylesheets to `*.stylex.ts` naming convention project-wide.
  - **12B (Pragmatic CQRS & Domain Port Decoupling — ADR-011):**
    - Public CQRS application context: features consume pure Domain Port repositories (`context.repositories`) directly for TanStack Query read models, while routing all state mutations and business orchestration through framework-agnostic use cases (`context.useCases`).
    - Transaction port decoupling: introduced abstract domain ports (`SyncReconciler`, `StudyPackageImportService`, `ConflictDraftRepository.resolveConflict`) decoupling use cases and `SyncEngine` from direct IndexedDB database transactions.
    - Modularized composition root: partitioned monolithic use-case factory into isolated domain slice factories (`createAiUseCases`, `createLibraryUseCases`, `createQuizUseCases`, etc.) with a clean typed dependency injection context (`bootstrap/`).
  - **12C (Bounded Context Decomposition & Layer Taxonomies — ADR-014, ADR-015, ADR-016):**
    - Catalog bounded context decomposition (ADR-014): partitioned monolithic catalog into 4 isolated features (`materials`, `subjects`, `terms`, `discovery`) adhering to a strict Directed Acyclic Graph (DAG) dependency model.
    - Application screen layer: established `src/app/screens/` to host and orchestrate route-level views, separating routing concerns from reusable feature domain widgets.
    - Uniform infrastructure taxonomy (ADR-015): restructured `src/infrastructure/` into functional subsystems (`api/`, `browser/`, `database/`, `importer/`, `storage/`) and isolated database schema/lifecycle into `database/schema/`.
    - Cloudflare Worker modularization (ADR-016): decomposed Worker monolith into Web Standards core primitives (`worker/src/core/`), zero-dependency declarative router (`worker/src/router.ts`), 8 isolated route handlers (`worker/src/routes/`), and in-memory D1 test harness (`mockD1.ts`).
    - AI feature consolidation: merged generator into `src/features/ai/generator/` and unified AI domain models.
    - Uniform domain taxonomy (ADR-013): categorized `src/domain/` into `models/`, `repositories/`, `services/`, `engines/`, `strategies/`, `reconcilers/`, `utils/`, and `errors/`.
    - Universal direct-path imports (ADR-010): pruned all barrel files (`index.ts`) project-wide across domain, application, features, and shared primitives.
  - **12D (Presentation Quality & React Doctor Hardening):**
    - React Doctor triage and resolution: decomposed oversized screens and dialogs (`ConflictDraftsModal`, `SharedPackageScreen`, `AiQuestionGeneratorDialog`, `AiFlashcardGeneratorDialog`) into focused subcomponents.
    - Custom hook extractions: extracted `useMaterialWriterState`, `useHeaderScroll`, and unified navigation schemas (`PRIMARY_NAV_ITEMS`).
    - Rule governance: codified intentional overrides in `doctor.config.ts` for sequential sync operations, dirty material-switch state adjustments, and guarded draft synchronization.
  - **12E (Comprehensive Verification & Test Pyramid — ADR-012):**
    - Automated boundary guardrails: implemented static architectural boundary test suite (`src/__tests__/boundary/`) enforcing domain purity, shared layer purity, and cross-layer import constraints.
    - 1:1 granular test discoverability (ADR-012): created dedicated 1:1 unit test suites across all 14 application use-case domains, domain calculation engines, infrastructure repositories, database services, and Worker route handlers.
    - Metric milestone: achieved **1,210 passing Vitest tests across 266 test files** with 0 failures, 0 oxlint warnings, and 0 typecheck errors.
    - Playwright real-browser E2E acceptance suites: added comprehensive suites for first-run onboarding tutorial progression, reader annotations & canvas drawing persistence across page reloads, active quiz runner grading, and 3D flip flashcard study sessions with SM-2.

---

## Planned Phases

*(To be determined / scoped during upcoming planning sessions.)*


