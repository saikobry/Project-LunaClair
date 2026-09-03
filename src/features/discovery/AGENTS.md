# src/features/discovery/ — Content Discovery Bounded Context

## Purpose

Owns remote catalog discovery, Explore hub aggregation, public share cloning, and read-only material preview hooks. Interfaces with the Cloudflare D1 worker API for available learning materials.

## Ownership

- `hooks/` — Discovery queries and mutations:
  - `queries/useAvailableCatalog.ts` — Query hook fetching the remote D1 catalog snapshot (`GET /api/catalog`).
  - `queries/useAvailableMaterial.ts` — Query hook fetching authoritative resolution for a single remote material (`GET /api/catalog/materials/:id`).
  - `queries/usePreviewDocument.ts` — Query hook fetching document markdown for the read-only preview surface.
  - `useExploreContent.ts` — Multi-source explore aggregator unifying official coursework and community shares with filtering and sorting.
  - `usePublicShares.ts` — Query hook fetching public shares (`GET /api/shares`).
  - `useCloneShare.ts` — Mutation hook for 1-click cloning of published study packages into the local library.
  - `mutations/useImportMaterial.ts` — Mutation hook importing a remote material into local Dexie store.
  - `mutations/useRemoveImportedMaterial.ts` — Mutation hook removing an imported material from Dexie.
- `queries/` — Cache key definitions:
  - `discoveryQueryKeys.ts` — Query key factory for remote catalog (`['catalog', 'remote']`) and available materials (`['catalog', 'remote', 'material', id]`).
- `types/` — Discovery types:
  - `explore.types.ts` — Types for explore sources, filters, and items.

## Local Contracts

- **Directed Dependencies (ADR-014)**: Depends unidirectionally on `materials/` (for local library status check, invalidation, and import use cases) and `subjects/` (for invalidation). Must not depend on `reader/`, `quiz/`, or `app/screens/`.
- The catalog is never auto-hydrated into Dexie on app startup. Materials are imported exclusively on user action via `useImportMaterial`.
- Route-level explore and preview screens belong to `src/app/screens/explore/ExploreScreen.tsx` and `src/app/screens/preview-material/PreviewMaterialScreen.tsx`.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
