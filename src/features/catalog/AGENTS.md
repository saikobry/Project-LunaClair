# src/features/catalog/ — Catalog & Learning Hierarchy

## Purpose

Unified Catalog & Learning Hierarchy feature module. Consolidates content discovery, remote canonical catalogs, the local library workspace, and the academic classification taxonomy (Subjects, Terms, Materials).

## Ownership

`catalog/` is an architectural **compound feature** organized into 5 sub-capabilities and 2 shared modules:

| Sub-capability | Scope | Ownership & Responsibility |
|---|---|---|
| `available/` | `catalog/available/` | Canonical remote (D1) catalog discovery and authoritative read-only material preview (`/available/:id/preview`, `PreviewMaterialScreen`). Manages remote material resolution and local import (`useImportMaterial`, `useRemoveImportedMaterial`). |
| `explore/` | `catalog/explore/` | Explore Hub (`/explore`, `ExploreScreen`). Unifies official coursework with community study packages, public share browsing (`usePublicShares`), source filtering (`[ All \| Official \| Community ]`), and 1-click cloud cloning (`useCloneShare`). |
| `materials/` | `catalog/materials/` | Local library material lifecycle (`LibraryScreen`, `MaterialCard`, `MaterialGrid`). Manages imported materials, local metadata editing (`CreateMaterialModal`, `EditMaterialModal`, `DeleteConfirmationModal`), and "last opened" touch tracking. |
| `subjects/` | `catalog/subjects/` | Subject-scoped workspace (`SubjectWorkspace`). Manages subject lifecycle, reordering (`useReorderSubjects`), and orchestrates tabbed views (`MaterialsTab`, `SubjectTermsTab`, `SubjectQuizTab`). |
| `terms/` | `catalog/terms/` | Academic term governance (`TermManagerScreen`, `TermManagerModal`). Manages term entities and many-to-many Subject ↔ Term associations (`useSubjectTermMutations`, `useSubjectTermUsage`, `useTermUsageCounts`). |
| `shared/` | `catalog/shared/` | Internal catalog style rules (`shared/styles/library.stylex.ts`). |
| `queries/` | `catalog/queries/` | Query key factory (`catalogQueryKeys.ts`) owning cache namespaces across remote catalogs, local materials, subjects, terms, and public shares. |

## Local Contracts

- **Compound Feature Aggregate**: The 5 sub-capabilities form an intentional learning-content aggregate representing the student's study curriculum. They remain unified under `catalog/` to reflect their shared domain invariants and shared cache lifecycle.
- **Sub-Capability Isolation Rule**: Sub-capabilities must not import implementation details from another sub-capability unless the dependency is explicitly listed as a permitted cross-subcapability flow below. Internal component/hook privacy applies within each sub-capability.
- **Permitted Cross-Subcapability Flows**:
  - `available/components/PreviewMaterialScreen` $\rightarrow$ `materials/hooks/queries/useLibrary` (to detect if a canonical material is already imported).
  - `materials/modals/*` $\rightarrow$ `terms/hooks/queries/useTerms` (to assign an academic term to a study material).
  - `materials/modals/*` & `subjects/modals/*` $\rightarrow$ `shared/styles/library.stylex` (modal form layout styling).
  - `subjects/components/MaterialsTab` $\rightarrow$ `materials/components/MaterialCard` (card rendering within subject scope).
  - `subjects/components/SubjectWorkspace` $\rightarrow$ `materials/hooks/` (`useLibrary`, `useCreateMaterial`, `useEditMaterial`, `useDeleteMaterial`), `materials/modals/`, `terms/components/SubjectTermsTab`, and `terms/hooks/queries/useTerms` (workspace tab composition).
  - `terms/components/SubjectTermsTab` $\rightarrow$ `materials/hooks/queries/useLibrary` (to show material count using terms).
  - `terms/hooks/queries/useTermUsageCounts` $\rightarrow$ `materials/hooks/queries/useLibrary` (to calculate per-term material counts).
  - All sub-capabilities $\rightarrow$ `queries/catalogQueryKeys` (central query cache keys).
- **Capability Screens vs Feature Screens**: Because `catalog` is a compound feature, its primary screens are **Capability Screens** located inside their respective sub-capability folder (`<subcapability>/components/<Screen>.tsx`):
  - `catalog/available/components/AvailableMaterialsScreen.tsx`
  - `catalog/available/components/PreviewMaterialScreen.tsx`
  - `catalog/explore/components/ExploreScreen.tsx`
  - `catalog/materials/components/LibraryScreen.tsx`
  - `catalog/subjects/components/SubjectWorkspace.tsx`
  - `catalog/terms/components/TermManagerScreen.tsx`
- **Catalog-First, User-Selected Library Model**: The remote D1 catalog is never copied wholesale into local Dexie storage on boot. Dexie holds the user's explicit local working set (`useLibrary`), while remote catalog queries use TanStack Query with `networkMode: 'offlineFirst'`.
- **Authoritative Single-Material Resolution**: Single-material preview and import resolve the material authoritatively per-id (`GET /api/catalog/materials/:id`) without requiring the full catalog snapshot in memory.
- **Cross-Feature Direct Paths**: Outside features consume catalog capabilities only via approved direct paths registered in `src/features/AGENTS.md`. No root `index.ts` barrel is exposed (ADR-010).

## Work Guidance

- Colocate all unit/component tests in `__tests__/` alongside the tested unit (ADR-012).
- Route all write operations (create, edit, delete, reorder, import, unlink) through `src/application/` use cases (`CreateSubjectUseCase`, `UpdateSubjectUseCase`, `ReorderSubjectsUseCase`, `CreateTermUseCase`, `UpdateTermUseCase`, `ImportMaterialUseCase`, `RemoveImportedMaterialUseCase`, `ClonePublicShareUseCase`).

## Verification

- `npm run test:run` — Runs all catalog unit, query, mutation, and screen tests.
- `npm run lint` — Validates Oxlint boundary guardrails and zero restricted infrastructure imports.
- `npm run build` — Validates TypeScript and production bundling.
