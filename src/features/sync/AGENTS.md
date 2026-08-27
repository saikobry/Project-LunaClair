# src/features/sync/ — Cloud Synchronization UX

## Purpose

Feature-level presentation, reactive subscription hooks, status pill UI, and interactive document conflict resolution modal for Phase 10 Cloud Synchronization.

## Ownership

- `hooks/useSyncStatus.ts` — React subscription hook querying `SyncStatusStore`, `pendingCount`, `lastSyncedAt`, `lastError`, and `conflictCount` from `useCases.sync.getConflictDrafts()`, exposing `triggerSync()`.
- `hooks/useConflictDrafts.ts` — Hook for querying and resolving divergent document drafts via `useCases.sync.getConflictDrafts()` and `useCases.sync.resolveConflictDraft()`.
- `components/SyncStatusPill.tsx` — Accessible, StyleX-styled status pill rendered in `AppSidebar` footer. Displays real-time states (🟢 `Synced`, 🔄 `Syncing...`, 🟡 `Offline`, ⚠️ `Sync error`, 🚨 `${conflictCount} conflict(s)`) and opens `ConflictDraftsModal` on conflict click or triggers manual sync on idle click.
- `components/ConflictDraftsModal.tsx` — Accessible modal dialog for side-by-side / tabbed diff comparison between canonical server version and divergent local draft, offering `[Keep Server Version]`, `[Keep My Version]`, and `[Edit & Merge]` resolution workflows.
- `utils/formatSyncTime.ts` — Relative time formatting utility for last synchronized timestamps.

## Local Contracts

- UI components contain 0 direct imports of `src/infrastructure/**` or database connections. All mutations route through `context.useCases.sync.*`.
- Feature follows direct-path imports (ADR-010): consumed by `AppSidebar` via `src/features/sync/components/SyncStatusPill`.
- Reactive state flows from `SyncStatusStore` singleton / application context down to `useSyncStatus`.
- Conflict resolution actions atomically update local `documentContents`, delete the resolved `conflictDraft`, enqueue transactional outbox mutations when applicable, and trigger background synchronization.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

- `npm run test:run` — Unit and integration tests for hooks and components.
- `npm run build` — TypeScript and production bundling.
- `npm run lint` — Oxlint static boundary analysis.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
