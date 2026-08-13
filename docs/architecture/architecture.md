# Project LunaClair — Architecture Guide

**Studio:** Saiko Interactive  
**Version:** Phase 6.1 (Application Layer, Domain Boundary Refinement & Flashcards)

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
├── services/       # Content and external infrastructure services
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

Feature-based modules encapsulating UI components, hooks, queries, styles, and types. Features own business capabilities and consume other features only through curated root `index.ts` contracts; internal feature paths remain private.

Active features include `catalog/` (materials, subjects, and terms — consolidating the former `library/`, `subject/`, and `settings/` features), `reader/`, `quiz/`, `quiz-management/`, and `flashcards/`. Reserved boundaries include `importer/` and `generator/`.

### `src/shared/`

Reusable domain-agnostic types, constants, utility functions, design tokens, and UI/infrastructure primitives. Business capability code remains in its owning feature.

## Cloud Sync & Content Layer (Cloudflare D1)

- The PWA stays local-first (Dexie/IndexedDB); Cloudflare D1 (`lunaclair` database) serves as both the **study content store** (materials & figures) and the future **cloud sync layer** (Phase 9).
- Study materials (markdown & figure images) are hosted in D1, served on demand by the `api` Worker (`https://api.project-lunaclair.workers.dev`), and cached by the Service Worker via Workbox `CacheFirst` runtime caching, reducing initial app precache from 7.6 MB to ~1.5 MB.
- D1 is only reachable through the `api` Cloudflare Worker (`worker/`, config in root `wrangler.jsonc`): browser → Worker REST API → D1 binding (`DB`).
- Schema lives as versioned migrations in `worker/migrations/`; canonical markdown files live in `content/materials/` and are seeded via `scripts/seed-materials.mjs`.
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
| [ADR-009](adr/ADR-009-feature-ownership-and-public-contracts.md) | Feature Ownership & Public Contracts | Phase 6 |

## Import Rules

1. **Curated feature contracts.** Cross-feature consumers import only from the owning feature root `index.ts`.
2. **Internal feature privacy.** Deep imports into another feature's implementation paths are prohibited.
3. **Domain modules import only from other domains or pure libraries** — never from React, features, or services.
4. **Shared code is domain-agnostic** — extract only reusable neutral types and utilities to `shared/`.
5. **Infrastructure and services import from `domain/` contracts and `shared/` types/utilities, but never from features.**
6. **Barrel exports** (`index.ts`) are curated stable public APIs.
