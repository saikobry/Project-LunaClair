# Project LunaClair — Architecture Guide

**Studio:** Saiko Interactive  
**Version:** Phase 12 (Responsive Shell Experience & Architectural Hardening)

## Documentation Structure

```text
docs/
├── roadmap.md
└── architecture/
    ├── architecture.md
    ├── ui-guidelines.md
    ├── history/
    └── adr/
```

## Folder Philosophy

```text
src/
├── app/            # Application bootstrap: shell layout, navigation slices, screens, routing, providers, composition root
├── application/    # Framework-agnostic use cases and application workflows
├── domain/         # Business domain models, engines, ports, and reconcilers
├── infrastructure/ # Persistence, API transports, browser lifecycle, importer engines, storage
├── features/       # Bounded capability feature modules
├── shared/         # Domain-agnostic UI primitives, utilities, and shared contracts
└── styles/         # Global styles and master stylesheet
```

### `src/app/`

Application-level orchestration: root shell layout (`AppShell`, `AppHeader`, `AppSidebar`, `ShellRoutes`, `MaterialWorkspace`), dedicated viewport navigation slices (`DesktopSidebar`, `TabletRail`, `MobileBottomDock`), route-level screen layer (`src/app/screens/` — `HomeScreen`, `LibraryScreen`, `ExploreScreen`, etc.), configuration constants, React providers (`AppProviders`, `ApplicationProvider`, `FocusModeProvider`), and the composition root (`bootstrap/` with domain slice factories).

### `src/application/`

Framework-agnostic use cases coordinate domain contracts between presentation and persistence. Under ADR-011, use cases handle write mutations, transactions, and business workflows, while features read via domain port repositories in `context.repositories`. A use case never imports React, TanStack Query, Dexie, browser APIs, or UI components. Use cases span `quiz/`, `quiz-management/`, `library/`, `subject/`, `reader/`, `content/`, `flashcards/`, `analytics/`, `ai/`, `generator/`, `importer/`, `package/`, `sharing/`, and `sync/`.

### `src/domain/`

Pure business domain models, engines, and services organized under uniform responsibility directories (ADR-013). Domain modules have zero React or UI dependencies. Subdomains include `reader/`, `quiz/`, `library/`, `flashcards/`, `analytics/` (streak, activity calendar, mastery ranking, retention maturity/forecast, and overview aggregation), `ai/`, `generator/`, `importer/`, `sync/` (concurrency evaluation, reconcilers, LWW comparators), `package/` (`.lcpack` specification, validators, UUID remappers, inspectors), and `sharing/` (`ShareTransport` ports and access control types).

### `src/infrastructure/`

Boundary-first persistence and external service infrastructure (ADR-015):
- `database/`: Dexie database (Schema v11), schema definitions, startup initializer, migrator, repositories, atomic services, and sync reconcilers.
- `api/`: Cloudflare Worker REST API repositories, transports (`WorkerSyncTransport`, `WorkerShareTransport`), and transformers.
- `browser/`: Browser lifecycle listeners (`BrowserSyncLifecycle`) and storage credentials (`LocalStorageCredentialsProvider`).
- `importer/`: Document extractors (`PdfjsImporter`, `TesseractExtractor`, `ImageImporter`) and registry.
- `storage/`: Composite repositories (`HybridDocumentRepository`).

### `src/features/`

Feature-based modules encapsulating UI components, hooks, queries, styles, and types. Features own business capabilities and consume other features only through the approved direct module paths defined by ADR-010; internal feature paths remain private.

Active features include:
- `materials/` — Local study material management, material cards, and CRUD dialogs (ADR-014).
- `subjects/` — Academic subject hierarchy, workspaces, and modals (ADR-014).
- `terms/` — Academic terms management and subject-term junctions (ADR-014).
- `discovery/` — Remote catalog exploration, public share discovery, and read-only previews (ADR-014).
- `reader/` — Markdown reader with persistent highlights, drawing canvas, and table of contents.
- `quiz/` — 5-question-type assessment engine and interactive quiz player with atomic submission.
- `quiz-management/` — Question Bank authoring, visual Quiz Canvas builder, and type editors.
- `flashcards/` — Spaced repetition study mode (SM-2) with 3D flip card player.
- `writer/` — Lexical WYSIWYG authoring engine with lossless Markdown transformation.
- `analytics/` — Learning insights dashboard with KPI metrics, retention breakdown, review forecast, mastery matrix, and 52-week activity heatmap.
- `ai/` — Grounded AI Study Assistant with streaming chat drawer (`Llama 3.3 70B Instruct`), selection actions, and AI content synthesis dialogs (`generator/`).
- `importer/` — 5-step content ingestion wizard with PDF extraction and OCR fallback.
- `sync/` — Cloud synchronization status pill and conflict resolution modal.
- `package/` — Portable Study Package (`.lcpack`) import/export, cloud share link publishing, and shared package landing screen.

### `src/shared/`

Reusable domain-agnostic types, constants, utility functions, design tokens, and UI/infrastructure primitives. Business capability code remains in its owning feature.

## Cloud Sync & Content Layer (Cloudflare D1 & Workers)

- The PWA stays local-first (Dexie/IndexedDB); Cloudflare D1 (`lunaclair` database) serves as the **study content store** (materials & figures), the **cloud sync replication layer** (Phase 10), and the **cloud sharing link store** (Phase 11).
- Study materials (markdown & figure images) are hosted in D1, served on demand by the `api` Worker (`https://api.project-lunaclair.workers.dev`), and cached by the Service Worker via Workbox `CacheFirst` runtime caching, reducing initial app precache from 7.6 MB to ~2.8 MB across 51 entries (measured at build).
- D1 is only reachable through the `api` Cloudflare Worker (`worker/`, config in root `wrangler.jsonc`): browser → Worker REST API → D1 binding (`DB`).
- Schema lives as versioned migrations in `worker/migrations/`; canonical markdown files live in `content/materials/` and are seeded via `scripts/seed-materials.mjs`.
- **Study-package distribution.** `.lcpack` StudyPackage sharing (`/api/shares`, `SharedPackageScreen`) is the exclusive content distribution mechanism — the legacy catalog/quiz endpoints and tables were retired (Phase 5, Sep 2026). The app does not auto-hydrate D1 into Dexie on boot — a fresh install starts with an empty library. Coursework and community study packs are surfaced via the **Explore Hub** (`/explore`); users clone shares into their local Dexie library.
- Cloud synchronization uses a transactional outbox (`syncQueue`), single SQL atomic CAS versioning, LWW recency comparisons, and an exponential backoff single-flight `SyncEngine`.
- Public and protected share links are stored in D1 with salted PBKDF2/SHA-256 passcode hashes and download telemetry counters.

## Application Workflow Boundaries

- **Quiz Lifecycle:** `StartQuizSessionUseCase → SubmitQuizSessionUseCase` is the quiz lifecycle. Submission grades immutable session snapshots through `AssessmentService`, persists the result, completes the session as one application operation, and invalidates analytics queries.
- **Flashcard Lifecycle:** `RecordFlashcardReviewUseCase` updates spaced-repetition card intervals/ease/lapses and invalidates analytics queries.
- **Analytics Orchestration:** `DexieAnalyticsRepository` retrieves raw IndexedDB records concurrently across stores (`quizSessions`, `flashcardReviews`, `questions`, `materials`, `subjects`) and dispatches pure calculation engines in `domain/analytics/` (`computeStudyOverview`, `computeCardMaturity`, `computeReviewForecast`, `computeSubjectMasteries`, `buildActivityCalendar`). Use cases (`GetGlobalAnalyticsUseCase`, `GetSubjectAnalyticsUseCase`, `GetMaterialAnalyticsUseCase`) deliver clean view models to TanStack Query and UI components.
- **Content Importer:** `ExtractContentUseCase → CommitImportUseCase` converts external PDF/image assets into structured markdown, stores binary blobs in `importAssets`, and registers local study materials.
- **Cloud Sync:** `TriggerSyncUseCase` runs `SyncEngine` single-flight convergence (pull delta → reconcile → push outbox → pull catchup); divergences create `ConflictDraft` snapshots resolved via `ResolveConflictDraftUseCase`.
- **Study Packages & Sharing:** `MaterializeStudyPackageUseCase` extracts local entities into portable `.lcpack` bundles; `PublishStudyPackageUseCase` uploads packages to Cloudflare D1; `ClonePublishedShareUseCase` runs `remapStudyPackage` for collision-free UUID generation and commits the cloned package into the local library in a single atomic transaction.

## Architecture Decision Records (ADRs)

Key decisions are documented in [`docs/architecture/adr/`](adr/README.md).

| ADR | Decision | Introduced |
| :--- | :--- | :--- |
| [ADR-001](adr/ADR-001-repository-pattern.md) | Repository Pattern for Data Access | Phase 2 |
| [ADR-002](adr/ADR-002-react-context-di.md) | React Context Dependency Injection | Phase 2 |
| [ADR-003](adr/ADR-003-tanstack-query.md) | TanStack Query Caching & Mutations | Phase 3 |
| [ADR-004](adr/ADR-004-dexie-indexeddb.md) | Dexie.js IndexedDB Infrastructure | Phase 5 |
| [ADR-005](adr/ADR-005-strategy-pattern.md) | Strategy Pattern for Question Behavior | Phase 5 |
| [ADR-006](adr/ADR-006-immutable-quiz-history.md) | Immutable Quiz History via Question Snapshots | Phase 5 |
| [ADR-007](adr/ADR-007-feature-first-architecture.md) | Feature-First Module Organization | Phase 1 |
| [ADR-009](adr/ADR-009-feature-ownership-and-public-contracts.md) | Feature Ownership & Public Contracts | Phase 6 (superseded by ADR-010) |
| [ADR-010](adr/ADR-010-replace-barrel-based-feature-boundaries.md) | Replace Barrel-Based Feature Boundaries | Phase 6 |
| [ADR-011](adr/ADR-011-public-application-context-and-cqrs-read-model.md) | Public Application Context, Composition Root Slices, and CQRS Read Model | Phase 12 |
| [ADR-012](adr/ADR-012-primary-unit-test-organization-and-discoverability.md) | Primary Unit Test Organization and 1:1 Discoverability Standard | Phase 12 |
| [ADR-013](adr/ADR-013-uniform-domain-module-organization.md) | Uniform Domain Module Organization | Phase 12 |
| [ADR-014](adr/ADR-014-bounded-contexts-and-screen-layer.md) | Bounded Contexts and Application Screen Layer | Phase 12 |
| [ADR-015](adr/ADR-015-uniform-infrastructure-module-organization.md) | Uniform Infrastructure Module Organization | Phase 12 |
| [ADR-016](adr/ADR-016-uniform-cloudflare-worker-architecture.md) | Uniform Cloudflare Worker Architecture | Phase 12 |

## Import Rules

1. **Direct-path feature contracts (ADR-010).** Feature-root barrels are removed; cross-feature consumers import only the approved direct module paths listed in `src/features/AGENTS.md` (no-barrel-import allow-list).
2. **Internal feature privacy.** Deep imports into another feature's implementation paths are prohibited.
3. **Domain modules import only from other domains or pure libraries** — never from React, features, or infrastructure.
4. **Shared code is domain-agnostic** — extract only reusable neutral types and utilities to `shared/`.
5. **Infrastructure imports from `domain/` contracts and `shared/` types/utilities, but never from features.**
6. **No barrel boundaries (ADR-010).** Barrels are no longer used as feature public APIs; any remaining `index.ts` must be consumed by imports, not retained as documentation.
