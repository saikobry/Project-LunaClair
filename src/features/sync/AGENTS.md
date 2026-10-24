# src/features/sync/ — Cloud Synchronization UX

## Purpose

Feature-level presentation, reactive subscription hooks, status pill UI, interactive document conflict resolution modal, and BYOS cloud storage preferences for BYOS Google Drive Cloud Synchronization.

## Ownership

- `hooks/useSyncStatus.ts` — React subscription hook querying `SyncStatusStore`, `pendingCount`, `lastSyncedAt`, `lastError`, and reactive `conflictCount` via Dexie `useLiveQuery` on `db.conflictDrafts.count()` (falling back to `useCases.sync.getConflictDrafts()` when uninitialized), exposing `triggerSync()`, `reconnectAuth()`, `pauseSync()`, `resumeSync()`, `isPaused`, `authStatus`, `isAuthenticated`, `activeOwnerSub`, and `libraryLabel`. Resolves to `'paused'` with retained pendingCount when paused, and to `'standby'` with suppressed `pendingCount` and `lastError` when unauthenticated, routing unauthenticated `triggerSync()` calls to Google auth login.
- `hooks/useConflictDrafts.ts` — Hook for querying and resolving divergent document drafts via Dexie `useLiveQuery` on `db.conflictDrafts` (falling back to `useCases.sync.getConflictDrafts()` when uninitialized) and `useCases.sync.resolveConflictDraft()`, invalidating reader and material query caches on draft resolution.
- `components/SyncStatusPill.tsx` — Accessible, StyleX-styled status pill rendered in `AppSidebar` footer and header. Displays real-time states (🟢 `Synced`, 🔄 `Syncing...`, 🟡 `Offline`, ⚠️ `Sync error`, ⏸️ `Paused`, ☁️ `Standby`, 🚨 `${conflictCount} conflict(s)`), exposes selected-library identity in tooltip and accessible label (`Local-only Library • Local storage` or `Account Library (${user}) • Synced`), conditionally mounts `ConflictDraftsModal` on conflict click, triggers `resumeSync()` on paused click, triggers manual sync on idle click, and opens a connection preflight `ConfirmationDialog` before initiating Google connect on standby or unauthenticated click with suppressed pending/error badges.
- `components/ConflictDraftsModal.tsx` — Shared `<Dialog>`-based modal for side-by-side diff comparison between canonical server version and divergent local draft, offering `[Keep Server Version]`, `[Keep My Version]`, and `[Edit & Merge]` resolution workflows. The `[Edit & Merge]` editor is the shared `<TextArea>` with `autoGrow={false}` **on purpose** — the adapter's auto-grow forces `resize: none` plus a computed height, while Astryx's own textarea style keeps native vertical resize, which a large merge blob needs; monospace is supplied via `style` and inherits into the inner textarea.
- `components/SyncSettingsSection.tsx` — Settings section for Google Drive Bring-Your-Own-Storage (BYOS) cloud sync, truthfully identifying active library identity (`Local-only Library` vs `Connected Account Library` vs `Retained Account Library`) regardless of auth state, preflight confirmation dialog on connect gestures, read-only verified collision notice pointing to the single standard local-library switch action, user profile, sync state badge (`synced`, `syncing`, `standby`, `error`, `paused`), manual sync triggers, confirmation-dialog-gated library switching, first-connect coexistence explanation, and disconnect action.
- `components/syncSettings.stylex.ts` — StyleX styles for `SyncSettingsSection`.
- `components/VaultStorageSection.tsx` — Local Vault & Storage Inspector UI displaying active vault identity (derived read-only from active pointer without registry mutation), honest saved-account labels for dormant or disconnected accounts without cross-user attribution, account linkage state, storage footprint gauge, table record counts, confirmation-dialog-gated library switching, bypass-origin cache clearing, and orphan vault pruning safeguards.
- `components/vaultStorage.stylex.ts` — StyleX styles for `VaultStorageSection`.
- `utils/formatSyncTime.ts` — Relative time formatting utility for last synchronized timestamps.

## Local Contracts

- UI components contain 0 direct imports of `src/infrastructure/**` or database connections. All mutations route through `context.useCases.sync.*`.
- Feature follows direct-path imports (ADR-010): consumed by `AppSidebar` via `src/features/sync/components/SyncStatusPill` and by `SettingsScreen` via `src/features/sync/components/SyncSettingsSection` and `src/features/sync/components/VaultStorageSection`.
- Auth integration routes through `context.infrastructure.providers.auth` domain port or injected `authService` prop, preserving the 0-infrastructure-import feature boundary.
- Maintenance mutations route through `context.useCases.sync.clearMediaCache` and `context.useCases.sync.pruneUnlinkedVaults` or injected delegates, executing under bypass transaction origin to emit zero deletion tombstones.
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
