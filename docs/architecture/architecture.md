# Project LunaClair — Architecture Guide

**Studio:** Saiko Interactive  
**Version:** Phase 6.2 (LunaClair Writer & Markdown Fidelity Stabilization)

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
├── app/            # Application bootstrap: shell layout, config, providers, composition root
├── application/    # Framework-agnostic use cases and application workflows
├── domain/         # Business domain models and pure domain services
├── infrastructure/ # Database infrastructure, schema, migrators, repositories
├── features/       # Ownership-driven feature modules
├── shared/         # Domain-agnostic UI, utilities, and shared contracts
└── styles/         # Global styles and master stylesheet
```

### `src/app/`

Application-level orchestration: root shell layout, configuration constants, React providers, and the composition root (`createRepositories`, `createUseCases`, `createApplication`).

### `src/application/`

Framework-agnostic use cases coordinate domain contracts. A use case never imports React, TanStack Query, Dexie, browser APIs, or UI components. React hooks call use cases directly for mutations; repositories remain available to query hooks during migration.

### `src/domain/`

Pure business domain models and services. Domain modules have zero React or UI dependencies.

### `src/infrastructure/`

Database persistence infrastructure (`src/infrastructure/database/`): Dexie database, schema versioning, startup lifecycle, migrators, seed data, and concrete repository implementations.

### `src/features/`

Feature-based modules encapsulating UI components, hooks, queries, styles, and types. Features own business capabilities and consume other features only through the approved direct module paths defined by ADR-010; internal feature paths remain private.

Active features include `catalog/` (materials, subjects, terms, and available catalog/import surfaces), `reader/`, `quiz/`, `quiz-management/`, `flashcards/`, and `writer/`. Reserved boundaries include `importer/` and `generator/`.

### `src/shared/`

Reusable domain-agnostic types, constants, utility functions, design tokens, and UI/infrastructure primitives. Business capability code remains in its owning feature.

## Cloud Sync & Content Layer (Cloudflare D1)

- The PWA stays local-first (Dexie/IndexedDB); Cloudflare D1 (`lunaclair` database) serves as both the **study content store** (materials & figures) and the future **cloud sync layer** (Phase 10).
- Study materials (markdown & figure images) are hosted in D1, served on demand by the `api` Worker (`https://api.project-lunaclair.workers.dev`), and cached by the Service Worker via Workbox `CacheFirst` runtime caching, reducing initial app precache from 7.6 MB to ~1.5 MB.
- D1 is only reachable through the `api` Cloudflare Worker (`worker/`, config in root `wrangler.jsonc`): browser → Worker REST API → D1 binding (`DB`).
- Schema lives as versioned migrations in `worker/migrations/`; canonical markdown files live in `content/materials/` and are seeded via `scripts/seed-materials.mjs`.
- The library catalog (subjects, terms, subject-term links, materials metadata) is D1-delivered: canonical JSON at `content/catalog/` seeded via `scripts/seed-catalog.mjs`, served as one public snapshot at `GET /api/catalog`. Quiz content (questions/quizzes) follows the same pattern: `content/quiz/` → `scripts/seed-quiz.mjs` → `GET /api/quiz`.
- **Catalog-first, user-selected library model.** The app does not auto-hydrate D1 into Dexie on boot — a fresh install starts with an empty library. The remote catalog is fetched on demand (TanStack Query → `GET /api/catalog`, SW runtime-cached) and surfaced as Available Materials (`/available`); the user explicitly imports materials (`ImportMaterialUseCase` → atomic `LibraryImportService` write of subject/term links, material, document markdown in the `documentContents` Dexie store, and questions/quizzes from `GET /api/quiz`). `HybridDocumentRepository` serves imported content from Dexie first, API second. Figures remain SW-cached. **D1 = canonical catalog; Dexie = user's local selection/working state; Service Worker Cache Storage = network cache, never library membership.**
- The Worker's `GET /health` endpoint verifies D1 connectivity.

## Application Workflow Boundary

`StartQuizSessionUseCase → SubmitQuizSessionUseCase` is the quiz lifecycle. Submission grades immutable session snapshots through `AssessmentService`, persists the result, and completes the session as one application operation. Material association checks and subject-term orchestration likewise live in application use cases, while repositories perform persistence only.

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

## Import Rules

1. **Direct-path feature contracts (ADR-010).** Feature-root barrels are removed; cross-feature consumers import only the approved direct module paths listed in `src/features/AGENTS.md` (no-barrel-import allow-list).
2. **Internal feature privacy.** Deep imports into another feature's implementation paths are prohibited.
3. **Domain modules import only from other domains or pure libraries** — never from React, features, or infrastructure.
4. **Shared code is domain-agnostic** — extract only reusable neutral types and utilities to `shared/`.
5. **Infrastructure imports from `domain/` contracts and `shared/` types/utilities, but never from features.**
6. **No barrel boundaries (ADR-010).** Barrels are no longer used as feature public APIs; any remaining `index.ts` must be consumed by imports, not retained as documentation.
