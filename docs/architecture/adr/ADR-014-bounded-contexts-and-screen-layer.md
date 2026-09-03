# ADR-014 — Bounded Contexts and Application Screen Layer

## Status
Accepted

## Introduced
Phase 12 — Architecture & Domain Standardization (Screen Layer & Bounded Contexts)

## Decision Drivers
- Need to cleanly separate route-level screens and cross-feature compositions from bounded domain capabilities.
- Dissolving the monolithic `catalog/` feature folder into distinct, single-responsibility bounded contexts: `materials`, `subjects`, `terms`, and `discovery`.
- Preventing circular dependencies between features by enforcing a strict Directed Acyclic Graph (DAG).
- Clarifying component responsibilities: feature-owned presentation components vs. route-level compositions.

## Context
LunaClair's `src/features/` directory previously bundled two distinct responsibilities:
1. **Domain Capabilities**: Business rules, state hooks, queries/mutations, and presentation components (e.g. `MaterialCard`, `SubjectCardGrid`, `ReaderView`).
2. **Route-Level Screens**: Complete page layouts that composed multiple disparate capabilities (e.g. `SubjectWorkspace` composing subjects, materials, terms, and quiz trees; `ExploreView` composing catalog discovery and cloud sharing).

Furthermore, `src/features/catalog/` had grown into an umbrella namespace containing four disparate concerns:
- Core study material library management (`catalog/materials/`)
- Academic subject hierarchy (`catalog/subjects/`)
- Global academic terms and subject-term linkages (`catalog/terms/`)
- Remote content discovery, explore hub, and read-only previews (`catalog/available/` and `catalog/explore/`)

This umbrella structure obscured module boundaries, complicated imports, and introduced circular dependencies across feature subtrees.

## Decision

### 1. Dedicated Application Screen Layer (`src/app/screens/`)
Route-level screens and cross-feature orchestrations belong exclusively to `src/app/screens/`:
- `src/app/screens/library/LibraryHomeScreen.tsx` (and `LibraryModals.tsx`)
- `src/app/screens/subject-workspace/SubjectWorkspaceScreen.tsx`
- `src/app/screens/material-workspace/MaterialWorkspaceScreen.tsx`
- `src/app/screens/explore/ExploreScreen.tsx`
- `src/app/screens/preview-material/PreviewMaterialScreen.tsx`
- `src/app/screens/terms/TermManagerScreen.tsx`
- `src/app/screens/quiz-session/QuizSessionScreen.tsx`
- `src/app/screens/quiz-canvas/QuizCanvasBuilderScreen.tsx`
- `src/app/screens/analytics/AnalyticsScreen.tsx`
- `src/app/screens/importer/ImporterScreen.tsx`
- `src/app/screens/shared-package/SharedPackageScreen.tsx`

`src/app/routing/ShellRoutes.tsx` routes directly to `src/app/screens/*`. Features must never own route screens or import from `src/app/screens/`.

### 2. Dissolution of `catalog/` into Flat Bounded Contexts
`src/features/catalog/` is completely dissolved into four flat, top-level bounded contexts:
- `src/features/materials/`: Local study material management, material cards, material creation/edit dialogs, and library queries.
- `src/features/subjects/`: Academic subject entities, subject cards, subject reordering, and modal editors.
- `src/features/terms/`: Academic terms, subject-term junctions, term assignment dialogs, and usage queries.
- `src/features/discovery/`: Remote catalog querying (`GET /api/catalog`), Explore hub filtering, public share discovery/cloning, and read-only preview hooks.

### 3. Feature Capabilities vs. Presentation Rules
Features represent bounded capabilities and may contain feature-owned presentation components (e.g., `MaterialCard`, `SubjectCardGrid`, `ReaderView`, `WriterEditor`). However:
- Components that orchestrate or compose multiple bounded contexts belong to the screen layer (`src/app/screens/`).
- Features must not contain route screens.
- Modals that require data from multiple features (such as `LibraryModals` composing material and subject dialogs) live in the screen layer.

### 4. Directed Acyclic Graph (DAG) Dependency Model
Cross-feature consumption follows an intentional direction and must never form cycles:
- `materials` is a foundational leaf capability with zero dependencies on other features.
- `subjects` and `terms` depend unidirectionally on `materials`.
- `reader` depends on `materials`.
- `writer` depends on `reader` and `materials`.
- `discovery` depends on `materials` and `subjects`.
- `quiz` depends on `materials` and `terms`.
- `flashcards` depends on `quiz`, `reader`, and `materials`.
- `quiz-management` depends on `quiz`, `reader`, `package`, `materials`, and `ai`.
- `package` depends on `subjects` and `terms`.
- `ai` depends on `quiz` (for question generation appearance and structures) and does not depend on `quiz-management`.
- `analytics` and `sync` have zero feature-to-feature dependencies.

This invariant is verified by automated architecture tests (`src/__tests__/architecture/featureBoundary.test.ts`).

## Alternatives Considered
- **Keep screens inside features**: Rejected because screens like `SubjectWorkspace` and `ExploreView` span multiple domain boundaries, creating artificial coupling and circular imports.
- **Hierarchical nesting under `catalog/`**: Rejected because nesting creates deep directory paths (`catalog/materials/hooks/queries/...`), hides bounded contexts, and encourages leaky abstractions.
- **Extract entire subsystems (e.g. canvas) into screens**: Rejected because domain-specific builders (like `QuizCanvas`) represent deep feature capabilities that belong inside their owning feature; the screen simply acts as a thin routing and composition shell.

## Consequences

### Positive
- Clear, unambiguous boundary: `src/app/screens/` orchestrates pages; `src/features/` implements capabilities.
- Bounded contexts are flat, discoverable, and have clear single responsibilities.
- Feature dependencies form a verified Directed Acyclic Graph with zero cycles.
- Elimination of barrel layers and direct-path imports make dependencies completely transparent.

### Negative / Trade-offs
- Requires screen files to coordinate state and pass props down to feature presentation components when cross-feature data is needed.

## Related ADRs
- [ADR-007](ADR-007-feature-first-architecture.md)
- [ADR-008](ADR-008-shared-ui-vs-components-layering.md)
- [ADR-009](ADR-009-feature-ownership-and-public-contracts.md)
- [ADR-010](ADR-010-replace-barrel-based-feature-boundaries.md)
- [ADR-011](ADR-011-public-application-context-and-cqrs-read-model.md)
