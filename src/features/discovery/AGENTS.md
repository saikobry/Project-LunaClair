# src/features/discovery/ — Content Discovery Bounded Context

## Purpose

Owns Explore hub aggregation and public share discovery/cloning. Interfaces with the Cloudflare D1 worker API for published `.lcpack` study packages.

## Ownership

- `explore.types.ts` — Shares-only Explore types: single `ExploreContentItem` shape for published `.lcpack` shares (`isVerified` platform badge, `isInLibrary` exact clone identity + `libraryMaterialId`, the local material the share was cloned into) and `ExploreSortOption`; `ExploreSourceFilter` was removed — Explore has no official/community split. `isInLibrary` and `libraryMaterialId` are derived from one `originShareId` lookup, so they cannot disagree — the card's "Open in library" next step needs the local id because it is not derivable from the share id.
  - `useExploreContent.ts` — Shares-only explore aggregator: queries public shares and resolves each share against one `originShareId` → local material id map (exact clone identity, never title matching), which answers both `isInLibrary` and the card's `libraryMaterialId` target. First match wins — a share cloned twice keeps a stable target (`useLibrary` returns a stable order). **Stateless by contract**: `q`/`sort` arrive as params because they are URL state (`/explore?q=&sort=`), so the hook only queries and maps — it owns no filter state and exports `DEFAULT_EXPLORE_SORT`. Requests carry `EXPLORE_PAGE_LIMIT` (`explore.types.ts`) because the hub has no cursor pagination yet; raising the ceiling or adding a cursor flow belongs with the plan in `docs/architecture/plans/explore-hub-overhaul-plan.md` §3.2.
  - **Known limitation — `isVerified` is unreachable.** `GET /api/shares` returns no `isVerified` (the D1 `shares` table has no such column), so `isVerified` is always false and every share renders the `Community` badge. The field is read through a cast that is kept deliberately until a verified column exists; do not build a verified/community filter on it. Evidence: `docs/architecture/plans/explore-hub-overhaul-plan.md` §3.1.
  - `useLocalOriginMaterials.ts` — The single source of **exact clone identity** for any surface: `originShareId` → local material id (`useLibrary` sorted, first match wins, so a twice-cloned share keeps one stable target). Answers both "is this share in my library?" and "which material did it become?" — one lookup, so the two can never disagree. Consumed by `useExploreContent` (card membership + its `libraryMaterialId`) and by `screens/shared-package/SharedPackageScreen` (which would otherwise only know about a clone *it* performed in the current session, and would offer a duplicate clone on every fresh visit). Do not re-derive membership per consumer.
  - `usePublicShares.ts` — Query hook fetching public shares (`GET /api/shares`).
  - `useCloneShare.ts` — Mutation hook for 1-click cloning of published study packages into the local library.

## Local Contracts

- **Directed Dependencies (ADR-014)**: Depends unidirectionally on `materials/` for exact clone identity (`useLibrary`) and post-clone cache invalidation (`materialQueryKeys`). Must not depend on `reader/`, `quiz/`, or `app/screens/`.
- **Removal is not owned here.** The local library's one removal contract is `features/materials` (`useRemoveMaterial` → `RemoveMaterialUseCase`). Discovery only ever *adds* a material, by cloning a published share — it never removes one, so no removal hook belongs in this feature.
- The catalog is never auto-hydrated into Dexie on app startup. Materials enter the local library only through explicit user action (package import / share clone).
- **Exact clone identity**: library membership for shares compares `material.originShareId === share.id`. Never reintroduce title-based matching. `ClonePublishedShareUseCase` stamps `originShareId` from the share ID at clone time (Dexie v12 index).
- **Every share-clone path must stamp `originShareId`.** Passing `originShareId` is what makes a clone recognisable afterwards — on the share landing screen, on the Explore hub, and across sessions. `SharedPackageScreen` imports through `importStudyPackage` (not `ClonePublishedShareUseCase`) because it already holds the package, so it must pass `originShareId: shareId` itself. A clone imported without it is anonymous: the hub will keep offering "Clone to Library" for a package that is already local, and a second click imports a duplicate.
- Route-level explore screen belongs to `src/app/screens/explore/ExploreScreen.tsx`. `/share/:id` (`SharedPackageScreen`) is the single non-imported-material viewing surface.
- **Opening a share stamps the hub's route as the origin.** The hub is the only in-app entry to `/share/:id`, and it passes its full route (`{ kind: 'explore', q, sort }`) — not just a surface name — so leaving a package returns to the same filtered view. This is required by the URL-state contract above: a bare `{ kind: 'explore' }` origin would silently drop the user's search and sort.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run`
- `npm run lint`
- `npm run build`

## Child DOX Index

(No child directories with AGENTS.md.)
