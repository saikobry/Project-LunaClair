# src/features/sync/ — Cloud Synchronization UX

## Purpose

Feature-level presentation, reactive subscription hooks, status pill UI, interactive document conflict resolution modal, and BYOS cloud storage preferences for Phase 10 Cloud Synchronization.

## Ownership

- `hooks/useSyncStatus.ts` — React subscription hook querying `SyncStatusStore`, `pendingCount`, `lastSyncedAt`, `lastError`, and `conflictCount` from `useCases.sync.getConflictDrafts()`, exposing `triggerSync()` and `reconnectAuth()`.
- `hooks/useConflictDrafts.ts` — Hook for querying and resolving divergent document drafts via `useCases.sync.getConflictDrafts()` and `useCases.sync.resolveConflictDraft()`.
- `components/SyncStatusPill.tsx` — Accessible, StyleX-styled status pill rendered in `AppSidebar` footer. Displays real-time states (🟢 `Synced`, 🔄 `Syncing...`, 🟡 `Offline`, ⚠️ `Sync error`, ⏸️ `Paused`, 🚨 `${conflictCount} conflict(s)`), opens `ConflictDraftsModal` on conflict click, triggers manual sync on idle click, and triggers re-auth gesture on standby click.
- `components/ConflictDraftsModal.tsx` — Shared `<Dialog>`-based modal for side-by-side diff comparison between canonical server version and divergent local draft, offering `[Keep Server Version]`, `[Keep My Version]`, and `[Edit & Merge]` resolution workflows. The `[Edit & Merge]` editor is the shared `<TextArea>` with `autoGrow={false}` **on purpose** — the adapter's auto-grow forces `resize: none` plus a computed height, while Astryx's own textarea style keeps native vertical resize, which a large merge blob needs; monospace is supplied via `style` and inherits into the inner textarea.
- `components/SyncSettingsSection.tsx` — Settings section for Google Drive Bring-Your-Own-Storage (BYOS) cloud sync, displaying connection status, user profile, sync state badge (`synced`, `syncing`, `standby`, `error`), manual sync trigger, and disconnect action.
- `components/syncSettings.stylex.ts` — StyleX styles for `SyncSettingsSection`.
- `utils/formatSyncTime.ts` — Relative time formatting utility for last synchronized timestamps.

## Local Contracts

- UI components contain 0 direct imports of `src/infrastructure/**` or database connections. All mutations route through `context.useCases.sync.*`.
- Feature follows direct-path imports (ADR-010): consumed by `AppSidebar` via `src/features/sync/components/SyncStatusPill` and by `SettingsScreen` via `src/features/sync/components/SyncSettingsSection`.
- Auth integration routes through `context.infrastructure.providers.auth` domain port or injected `authService` prop, preserving the 0-infrastructure-import feature boundary.
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
