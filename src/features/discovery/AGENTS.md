# src/features/discovery/ — Content Discovery Bounded Context

## Purpose

Owns Explore hub aggregation and public share discovery/cloning. Interfaces with the Cloudflare D1 worker API for published `.lcpack` study packages.

## Ownership

- `explore.types.ts` — Shares-only Explore types: single `ExploreContentItem` shape for published `.lcpack` shares (`isVerified` platform badge, `isInLibrary` exact clone identity) and `ExploreSortOption`; `ExploreSourceFilter` was removed — Explore has no official/community split.
  - `useExploreContent.ts` — Shares-only explore aggregator: queries public shares, derives `isInLibrary` from the materials' `originShareId` set (exact clone identity, never title matching).
  - `usePublicShares.ts` — Query hook fetching public shares (`GET /api/shares`).
  - `useCloneShare.ts` — Mutation hook for 1-click cloning of published study packages into the local library.
  - `mutations/useRemoveImportedMaterial.ts` — Mutation hook removing an imported material from Dexie (invalidates `materialQueryKeys`).

## Local Contracts

- **Directed Dependencies (ADR-014)**: Depends unidirectionally on `materials/` (for local library status check, invalidation, and import use cases). Must not depend on `reader/`, `quiz/`, or `app/screens/`.
- The catalog is never auto-hydrated into Dexie on app startup. Materials enter the local library only through explicit user action (package import / share clone).
- **Exact clone identity**: library membership for shares compares `material.originShareId === share.id`. Never reintroduce title-based matching. `ClonePublishedShareUseCase` stamps `originShareId` from the share ID at clone time (Dexie v12 index).
- Route-level explore screen belongs to `src/app/screens/explore/ExploreScreen.tsx`. `/share/:id` (`SharedPackageScreen`) is the single non-imported-material viewing surface.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
