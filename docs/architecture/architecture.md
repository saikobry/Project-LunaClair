# Project LunaClair — Architecture Guide

**Studio:** Saiko Interactive  
**Version:** Phase 6 (Application Layer & Domain Boundary Refinement)

---

## Documentation Structure

```text
docs/
├── roadmap.md                   # Project roadmap (completed & planned phases)
└── architecture/
    ├── architecture.md          # Current living architecture guide (this file)
    ├── ui-guidelines.md         # UI layering & styling rules
    ├── history/                 # Architecture chronicles by phase
    │   └── phase-05.md
    └── adr/                     # Immutable Architecture Decision Records
        ├── README.md
        ├── ADR-001-repository-pattern.md
        └── ...
```

---

## Folder Philosophy

```text
src/
├── app/            # Application bootstrap: shell layout, config, providers, composition root
├── application/    # Framework-agnostic use cases and application workflows
├── domain/         # Business domain models (pure data, no UI) & domain services
├── infrastructure/ # Database infrastructure (Dexie/IndexedDB, schema, migrators, repositories)
├── features/       # Feature modules (feature-based, isolated)
├── shared/         # Shared library: types, constants, utils, base UI primitives
├── services/       # Content & external infrastructure services
└── styles/         # Global styles and master stylesheet
```

### `src/app/`
Application-level orchestration: root shell layout, configuration constants, React providers, and the composition root (`createRepositories`, `createUseCases`, `createApplication`).

### `src/application/`
Framework-agnostic use cases coordinate domain contracts. A use case never imports React, TanStack Query, Dexie, browser APIs, or UI components. React hooks call use cases directly for mutations; repositories remain available to query hooks during migration.

### `src/domain/`
Pure business domain models and domain services — interfaces, types, pure functions, strategy resolvers, and pure domain services (`AssessmentService`). Domain modules must have **zero React or UI dependencies**.

Domain subdomains:
| Domain | Purpose |
|---|---|
| `reader/` | Document reading, annotations, highlighting |
| `quiz/` | Quiz engine models, strategies (`QuestionStrategyResolver`), `AssessmentService` |
| `library/` | Document/library catalog models |
| `generator/` | AI content generation models |

### `src/infrastructure/`
Database persistence infrastructure (`src/infrastructure/database/`): `LunaClairDatabase` (Dexie.js IndexedDB), schema versioning, startup lifecycle (`DatabaseInitializer`, `DatabaseMigrator`, `DatabaseSeeder`), and concrete repository implementations (`DexieQuestionRepository`, `DexieLibraryRepository`, etc.).

### `src/features/`
Feature-based modules encapsulating UI components, hooks, queries, styles, and types. Features are **strictly isolated** — they import from `shared/`, `domain/`, `infrastructure/`, or `services/`, but **never** from other features.

Active features:
| Feature | Status |
|---|---|
| `reader/` | ✅ Implemented |
| `library/` | ✅ Implemented |
| `quiz/` | ✅ Implemented (Phase 5 Assessment Engine) |
| `importer/` | 🔒 Reserved |
| `generator/` | 🔒 Reserved |
| `settings/` | 🔒 Reserved |

### `src/shared/`
Truly shared code: reusable types, constants, utility functions, design tokens, and base UI primitives.

### Application workflow boundary

`StartQuizSessionUseCase → SubmitQuizSessionUseCase` is the quiz lifecycle. Submission grades immutable session snapshots through `AssessmentService`, persists the result, and completes the session as one application operation. Material association checks and subject-term orchestration likewise live in application use cases, while Dexie repositories perform persistence only.

---

## Architecture Decision Records (ADRs)

Key architectural decisions are documented as durable records in [`docs/architecture/adr/`](adr/README.md).

| ADR | Decision | Introduced |
| :--- | :--- | :--- |
| [ADR-001](adr/ADR-001-repository-pattern.md) | Repository Pattern for Data Access | Phase 2 |
| [ADR-002](adr/ADR-002-react-context-di.md) | React Context Dependency Injection | Phase 2 |
| [ADR-003](adr/ADR-003-tanstack-query.md) | TanStack Query Caching & Mutations | Phase 3 |
| [ADR-004](adr/ADR-004-dexie-indexeddb.md) | Dexie.js IndexedDB Infrastructure | Phase 5 |
| [ADR-005](adr/ADR-005-strategy-pattern.md) | Strategy Pattern for Question Behavior | Phase 5 |
| [ADR-006](adr/ADR-006-immutable-quiz-history.md) | Immutable Quiz History via Question Snapshots | Phase 5 |
| [ADR-007](adr/ADR-007-feature-first-architecture.md) | Feature-First Module Organization | Phase 1 |

---

## Import Rules

1. **No cross-feature imports.** A feature must not import from another feature.
2. **Domain modules import only from other domains or pure libraries** — never from React, features, or services.
3. **Shared code lives in `shared/`** — extract shared types/utilities to `shared/`.
4. **Infrastructure/Services import from `domain/` (contracts) and `shared/` (types), but never from features.**
5. **Barrel exports** (`index.ts`) should re-export selectively — avoid deep import chains.
