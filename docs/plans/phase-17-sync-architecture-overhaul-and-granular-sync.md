# Phase 17 — Sync Architecture Overhaul, Custom Material Sync, & Granular Controls

**Status:** Approved Architectural Blueprint  
**Target:** Phase 17  
**Related Documents:** `docs/roadmap.md`, `docs/plans/phase-16-deterministic-explore-clone-identity.md`, `docs/architecture/adr/ADR-018-google-drive-appdata-sync-and-stateless-auth.md`, `src/domain/sync/models/sync.types.ts`  
**Reference Implementation:** [`docs/plans/reference/phase17-sync-sketch.ts`](file:///docs/plans/reference/phase17-sync-sketch.ts) (Verified against Dexie 4.4.6)  
**Reference Verification Suite:** [`docs/plans/reference/phase17-sync-sketch.test.ts`](file:///docs/plans/reference/phase17-sync-sketch.test.ts) (17/17 tests passing)

---

## 1. Context & Problem Statement

Phase 14 delivered Bring-Your-Own-Storage (Google Drive `appDataFolder`) synchronization, and Phase 16 unified multi-device Explore clone identities via deterministic keys and canonical epoch floor timestamps (`CANONICAL_FLOOR_HLC`).

However, architectural probes and consultation against Dexie 4.4.6 identified six critical bottlenecks and subtle engine edge cases:

1. **Repetitive Table Iteration & Polling Sprawl:**
   - Table streaming, delta calculation, and reconciliation duplicate imperative loops across hard-coded tables.
   - Periodic delta calculation (`updatedAt > watermark`) performs full table scans at $O(\text{tables} \times \text{records})$ instead of reactive change tracking.
2. **Transaction Hook & Metadata Vulnerabilities:**
   - Using module-level flags for remote apply or bypass leaks across concurrent asynchronous operations on disjoint tables.
   - Nested `db.transaction()` calls construct fresh `Transaction` instances that do not inherit custom properties, causing nested remote writes to masquerade as local writes and echo back to the outbox.
   - Outbox/tombstone operations targeting out-of-scope stores fail asynchronously without aborting the main write, leading to silent data loss.
3. **Missing Relational Ordering & Schema Evolutions:**
   - Inbound sync applies records unordered, risking foreign key violations when child questions, quizzes, or annotations replicate before their parent material.
   - Drive journals lack entity-level schema versioning and upcasters, risking incompatibility when client models evolve.
4. **FSRS State Commutativity Defect:**
   - Spaced repetition reviews (`flashcardReviews`) store mutable state directly. Replicating state rows via Last-Write-Wins (LWW) is non-commutative: cross-device reviews overwrite each other, losing retention intervals and review history.
5. **Custom Material Sync Asymmetry & Quota Waste:**
   - User-authored study materials only sync markdown text (`documentContents`). Root records (`materials`), Question Bank items (`questions`), and custom quizzes (`quizzes`) do not replicate across devices.
   - For Explore materials (`originShareId != null`), syncing full markdown text, questions, and quizzes across Drive appDataFolder journals duplicates storage for content that already exists on Cloudflare D1/CDN.
6. **Tombstone Vulnerability & Vault Opacity:**
   - Local database resets or category disabling risk emitting accidental DELETE tombstones to peer devices via outbox queues. `Table.clear()`, `bulkDelete()`, and `where().delete()` fire Dexie `deleting` hooks per row.
   - Local storage lacks diagnostics, 7-day quarantine recovery, and protections preventing the deletion of authoritative data without prior export.

---

## 2. Track 17A: Declarative Registry, Hook-Based Outbox, & Pure Merge Plugins

### 2.1 Unified Declarative Policy (`SYNC_POLICY`) & Completeness Guard

Instead of maintaining separate registries and allow-lists that can drift out of sync, all IndexedDB stores in `LunaClairDatabase` (16 stores) are defined in a single, comprehensive `SYNC_POLICY` record:

```typescript
export type TableClassification = 'authoritative' | 'derived' | 'localOnly';
export type SyncCategory = 'annotations' | 'flashcards' | 'customMaterials' | 'studyHistory';
export type MergeStrategyId = 'lww' | 'appendOnly' | 'casDraft';
export type Upcaster = (wireRow: unknown) => unknown;

export interface SyncEntityConfig<K extends TableName = TableName> {
  kind: 'authoritative';
  entity: string;                          // Wire entity name in journals (decoupled from Dexie table)
  mergeStrategy: MergeStrategyId;          // Pure merge strategy
  category: SyncCategory;                  // Sync category for granular user toggle
  dependencies: readonly TableName[];      // Restored parent tables before child
  parent?: { table: TableName; key(row: any): string | undefined }; // Relational check for orphans
  schemaVersion: number;                   // Contract version
  upcasters: Readonly<Record<number, Upcaster>>;
  excludeFields?: readonly string[];       // Ephemeral local properties stripped on wire
}

export interface DerivedConfig {
  kind: 'derived';
  rebuildFrom: readonly TableName[];       // Authoritative tables from which state is rebuilt
  reason: string;
}

export interface LocalOnlyConfig {
  kind: 'localOnly';
  reason: string;
  prunable: boolean;                       // Safe for Vault Inspector cache clear
}

export type TablePolicy<K extends TableName = TableName> =
  | SyncEntityConfig<K>
  | DerivedConfig
  | LocalOnlyConfig;
```

#### Compile-Time Exhaustiveness via TypeScript `satisfies`

A single TypeScript `satisfies` constraint ensures that every table has exactly one declared policy. Missing tables and phantom entries fail compilation immediately:

```typescript
export const SYNC_POLICY = {
  materials: { kind: 'authoritative', entity: 'material', mergeStrategy: 'lww', category: 'customMaterials', dependencies: [], schemaVersion: 1, upcasters: {} },
  questions: { kind: 'authoritative', entity: 'question', mergeStrategy: 'lww', category: 'customMaterials', dependencies: ['materials'], parent: { table: 'materials', key: (r) => r.materialId }, schemaVersion: 1, upcasters: {} },
  quizzes: { kind: 'authoritative', entity: 'quiz', mergeStrategy: 'lww', category: 'customMaterials', dependencies: ['materials', 'questions'], parent: { table: 'materials', key: (r) => r.materialId }, schemaVersion: 1, upcasters: {} },
  documentContents: { kind: 'authoritative', entity: 'documentContent', mergeStrategy: 'casDraft', category: 'customMaterials', dependencies: ['materials'], parent: { table: 'materials', key: (r) => r.materialId }, schemaVersion: 1, upcasters: {} },
  highlights: { kind: 'authoritative', entity: 'highlight', mergeStrategy: 'lww', category: 'annotations', dependencies: ['documentContents'], parent: { table: 'documentContents', key: (r) => r.documentId }, schemaVersion: 1, upcasters: {} },
  drawings: { kind: 'authoritative', entity: 'drawing', mergeStrategy: 'lww', category: 'annotations', dependencies: ['documentContents'], parent: { table: 'documentContents', key: (r) => r.documentId }, schemaVersion: 1, upcasters: {} },
  quizAttempts: { kind: 'authoritative', entity: 'quizAttempt', mergeStrategy: 'appendOnly', category: 'studyHistory', dependencies: ['quizzes'], parent: { table: 'quizzes', key: (r) => r.quizId }, schemaVersion: 1, upcasters: {} },
  reviewLogs: { kind: 'authoritative', entity: 'reviewLog', mergeStrategy: 'appendOnly', category: 'flashcards', dependencies: [], schemaVersion: 1, upcasters: {} },
  flashcardReviews: { kind: 'derived', rebuildFrom: ['reviewLogs'], reason: 'FSRS state = fold(reviewLogs); rebuilt on remote apply and parameter changes' },
  assetCache: { kind: 'localOnly', reason: 're-fetchable content cache', prunable: true },
  outbox: { kind: 'localOnly', reason: 'pending local ops; pruning loses unsynced changes', prunable: false },
  tombstones: { kind: 'localOnly', reason: 'delete markers needed to block resurrection', prunable: false },
  conflictDrafts: { kind: 'localOnly', reason: 'deterministically re-derivable from ops, but user-visible', prunable: false },
  heldOps: { kind: 'localOnly', reason: 'ops from newer clients waiting for upgrade; carried into snapshots', prunable: false },
  pendingHydrations: { kind: 'localOnly', reason: 'hydration queue for Explore pointers', prunable: false },
  syncCursor: { kind: 'localOnly', reason: 'per-vault sync position; reset together with data or not at all', prunable: false },
} satisfies { [K in TableName]: TablePolicy<K> };
```

#### Runtime Schema Verification & Vault Inspector Pruning Guard

1. **`assertPolicyMatchesSchema(db)`:** Catches drift between the TypeScript interface and the real Dexie database schema at boot. Throws descriptive errors if tables are missing or phantom.
2. **`isPrunable(tableName)`:** Centralized policy inquiry for destructive operations:
   ```typescript
   export const isPrunable = (t: TableName): boolean => {
     const p: TablePolicy = SYNC_POLICY[t];
     return p.kind === 'derived' || (p.kind === 'localOnly' && p.prunable);
   };
   ```

---

### 2.2 Three Pure Merge Plugins (`LwwPlugin`, `AppendOnlyPlugin`, `CasDraftPlugin`)

To ensure testability and prevent race conditions, merge plugins are **strictly pure** (no database access, no clock access, no network I/O):
- `capture(change, ctx)`: Executes synchronously inside Dexie hooks; stamps `_hlc`, `_rev`, `_anc` onto row objects and yields wire `JournalOp`.
- `apply(localState, op)`: Executes in the reconciler; takes local state (`row`, `tombstoneHlc`) and returns `MergeDecision<T>` (`noop`, `put`, or `del`).

```typescript
export interface MergePlugin {
  readonly id: MergeStrategyId;
  capture<T extends object>(change: LocalChange<T>, ctx: CaptureCtx): CaptureResult<T> | null;
  apply<T extends object>(state: LocalState<T>, op: JournalOp<T>): MergeDecision<T>;
}
```

#### 1. `LwwPlugin` (Last-Write-Wins with HLC)
- Used by: `materials`, `questions`, `quizzes`, `highlights`, `drawings`.
- `capture`: Allocates fresh HLC (`ctx.clock.tick()`). For deletes, yields `op: 'del'` and sets `tombstone: true`.
- `apply`: Compares incoming `op.hlc` against local `_hlc` and `tombstoneHlc`. If incoming is newer, applies row update or records tombstone. Ties are broken deterministically by device ID lexicographical ordering.

#### 2. `AppendOnlyPlugin` (Monotonic Event Stream)
- Used by: `reviewLogs`, `quizAttempts`.
- `capture`: Strictly requires `change.kind === 'create'`. Any attempt to update or delete throws `AppendOnlyViolation`.
- `apply`: Idempotent ingest by primary key. If the record already exists locally, returns `noop` without overwriting historical data.

#### 3. `CasDraftPlugin` (Optimistic Concurrency & Divergent Drafts)
- Used by: `documentContents` (authoritative user notes and markdown).
- `capture`: Stamps `_rev = hlc` and maintains an ancestor chain `_anc` (capped at 32 items to bound storage).
- `apply`:
  - **Fast-Forward:** If incoming `baseRevision === local._rev`, incoming updates cleanly.
  - **Already Applied:** If `op.hlc === local._rev` or `local._anc.includes(op.hlc)`, returns `noop`.
  - **Concurrent Divergence:** If two offline devices edit the same document concurrently, the edit with the higher HLC/revision wins as the main row. The losing edit is preserved as a deterministic `ConflictDraft` with ID `${entity}:${key}@${rev}`. Every replica converges on the exact same row and identical conflict drafts with zero data loss.
  - **Edit Beats Delete:** A concurrent update to a deleted document resurrects the document rather than losing unsaved content.

---

### 2.3 Verified `withOrigin` Transaction Wrapper & Parent-Chain Walking

Dexie hooks receive the active `Transaction` as their final argument. However, empirical testing revealed critical edge cases:
- `db.transaction()` creates a new `Transaction` instance for nested calls, losing custom object properties.
- Nested transactions retain a reference to `.parent`.
- Module-level flags bleed across concurrent queries.

#### Parent-Chain Traversal (`originOf(tx)`)

```typescript
export type TxOrigin = 'local' | 'remote' | 'bypass';
type TaggedTx = Transaction & { origin?: TxOrigin };

export function originOf(tx: Transaction | null | undefined): TxOrigin {
  for (let t = tx as TaggedTx | null | undefined; t; t = t.parent as TaggedTx | undefined) {
    if (t.origin) return t.origin;
  }
  return 'local'; // Untagged fails safe: local sync capture rather than silent drop
}
```

#### Sanctioned Entry Point: `withOrigin`

All writes to synchronized tables MUST route through `withOrigin`:

```typescript
export function withOrigin<T>(
  db: LunaClairDatabase,
  origin: TxOrigin,
  tables: Table[],
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  const cur = Dexie.currentTransaction;
  if (cur && originOf(cur) !== origin) {
    throw new OriginConflictError(`nested transaction origin ${origin} inside ${originOf(cur)}`);
  }
  const scope = [...new Set([...tables, db.outbox, db.tombstones, db.heldOps, db.conflictDrafts, db.syncCursor])];
  return db.transaction('rw', scope, async (tx) => {
    if (!cur) (tx as TaggedTx).origin = origin;
    return fn(tx);
  });
}
```

#### Hook Synchronous Guard & Abort on Failure

1. **Synchronous Scope Guard:** Hooks inspect `tx.storeNames.includes('outbox')`. If writing outside `withOrigin`, hooks throw `SyncScopeError` synchronously, preventing unsynced writes from committing.
2. **Atomic Rollback on Outbox Failure:** If `tx.table('outbox').add()` or `tx.table('tombstones').put()` rejects, the hook catches the error and executes `tx.abort()`. Unsynced changes are never left half-committed.
3. **Empty Mutation Suppression:** Identical `put()` operations fire `updating` hooks with empty modifications (`Object.keys(mods).length === 0`). Hooks skip empty mods, preventing no-op churn.
4. **No Non-Dexie `await` in Transactions:** Reconcilers download, gunzip, and parse all remote journal chunks **before** opening `withOrigin`. Never call `setTimeout` or `fetch` inside a transaction, which causes IndexedDB to auto-commit and leaves partial writes.

---

### 2.4 Relational Restore Ordering & Zero-Quarantine Orphan Tolerance

#### Kahn Topological Ordering (`restoreOrder()`)

Remote changes are sorted parents-first before application:
`materials` $\to$ `questions` $\to$ `quizzes` $\to$ `documentContents` $\to$ `highlights` / `drawings` $\to$ `quizAttempts` $\to$ `reviewLogs`.

#### Zero-Quarantine Orphan Tolerance

In distributed multi-chunk synchronization, network reordering can deliver a child before its parent:
1. **Write Immediately:** Children are written directly to their target tables without quarantine. Deterministic primary keys guarantee eventual consistency, and quarantine tables duplicate storage and complicate queries.
2. **Read-Side Defensive Contract:** UI queries never non-null assert parents. Queries use partitioning helpers (e.g. `highlightsWithDocument`) to separate visible annotations from orphaned annotations waiting for parent hydration.
3. **Orphan Detection & GC:** `findOrphans(db)` identifies broken relational pointers across chunk boundaries. A background GC job running under `withOrigin(db, 'bypass', ...)` purges lingering orphans whose parents have been tombstoned.

---

### 2.5 Entity Schema Evolution & Held Ops

1. **Wire Envelope:** All operations carry `schemaVersion: number`.
2. **Sequential Upcasters:** `upcast(op, cfg)` transforms payloads across versions $v \to v+1 \to \dots \to v_{\text{current}}$.
3. **`heldOps` Preservation:** Incoming operations with `op.schemaVersion > cfg.schemaVersion` or unknown entities are parked in `db.heldOps`. They are **never dropped**, ensuring local backups and snapshots carry newer client data forward without corruption.

---

## 3. Track 17B: Custom Material Sync & Hardened Pointer Sync

### 3.1 Custom Material Sync (`originShareId == null`)

For user-authored study materials created locally or imported via PDF/Markdown:
1. **Full Relational Replication:** Replicates `materials`, `questions`, `quizzes`, and `documentContents`.
2. **Relational Invariant:** Primary keys (`mat_*`, `q_*`, `quiz_*`) remain globally unique and stable across devices.
3. **Cascading Tombstones:** Deleting a custom material writes soft-delete tombstones across the material, questions, and quizzes to `outbox`.

### 3.2 Hardened Explore Pointer Sync (`originShareId != null`)

For materials cloned from Explore, canonical payloads already exist on Cloudflare D1/CDN:
1. **Lightweight Metadata Envelope (~100 Bytes):**
   ```typescript
   export interface MaterialPointerSyncPayload {
     materialId: string;       // mat_share_{originShareId}
     originShareId: string;    // Cloudflare D1 share UUID
     title: string;            // Course title for instant UI card rendering
     publishedAt: string;      // Canonical publication timestamp
     schemaVersion: number;    // Contract version (1)
     documentId: string;       // doc_share_{originShareId}
     clonedAt: string;         // Initial clone timestamp
     pinnedVersion?: number;   // Optional pinned package version
     deletedAt?: string;       // Soft-delete tombstone
   }
   ```
2. **Decoupled Hydration via `pendingHydrations`:**
   - Inbound sync writes the pointer and enqueues `{ originShareId, attempts: 0, nextAttemptAt: now }` to `db.pendingHydrations`.
   - The Drive sync cursor advances immediately without waiting on network I/O.
   - Background worker hydrates course bundles via `ClonePublishedShareUseCase` in Mode 1 (Cold Clone at `CANONICAL_FLOOR_HLC`).

### 3.3 Convert-on-Delist Protocol

If an Explore package returns 404/410 during background refresh:
- Device promotes the material locally to custom (`originShareId = null`).
- Enqueues full local markdown, questions, and quizzes to `outbox`, ensuring user notes survive Cloudflare delisting.

---

## 4. Track 17C: Granular Controls & Tombstone-Suppression Contract

### 4.1 Sync Category Preferences

Stored in `preferences` store (`sync_category_preferences`):
- `annotations`: `highlights`, `drawings` (default: true).
- `flashcards`: `reviewLogs` (default: true).
- `customMaterials`: `materials`, `questions`, `quizzes`, `documentContents` (default: true).
- `studyHistory`: `quizAttempts` (default: true).

### 4.2 Mandatory Tombstone-Suppression Contract

**Safety Invariant:** Local maintenance, category disabling, and database resets MUST run with `origin = 'bypass'` to suppress tombstone generation.

```typescript
// Safe cache clear or category purge
await withOrigin(db, 'bypass', [db.highlights], async () => {
  await db.highlights.clear();
});
// Hook sees originOf(tx) === 'bypass' -> Emits 0 outbox rows and 0 tombstones
```

---

## 5. Track 17D: Vault Safeguards, Storage Inspector, & Keyframe FSRS Architecture

### 5.1 Presentation Surface: `<VaultStorageSection />`

1. **Storage Telemetry:** Active database name, quota bar (`navigator.storage.estimate()`).
2. **Live Table Matrix:** Record counts across all 16 tables grouped by classification (`authoritative`, `derived`, `localOnly`).
3. **Registered Vaults Ledger:** Lists vaults in `lunaclair_registry`.

### 5.2 Destructive Action Safeguards

1. **Derived-Only Pruning:** `Clear Cache` only permits tables where `isPrunable(t) === true` (`assetCache`, `flashcardReviews`). Authoritative data is physically protected.
2. **Export-Gated Deletion:** Purging authoritative vaults requires downloading a backup export (.json/.lcpack) before confirmation.
3. **7-Day Quarantine:** Deleted vaults transition to `pendingDeleteAt: now + 7_DAYS` with 1-click restore before hard deletion.

---

### 5.3 Keyframe FSRS Architecture & Migration Pattern

Spaced repetition models (FSRS) compute intervals sequentially. Replicating mutable card state leads to non-commutative overwrites.

#### Architectural Separation
- `reviewLogs` is the **authoritative, append-only log** of user reviews.
- `flashcardReviews` is a **derived cache** (`kind: 'derived'`) computed by folding the review log.

#### Keyframe Log Entries
Existing state rows cannot be replayed from genesis because historical ratings were not previously retained. The migration uses deterministic keyframes:
1. **Migration (`migrateStateToKeyframes`):** Converts each existing `flashcardReviews` row into a `kind: 'keyframe'` log entry with deterministic ID `kf:${cardKey}:${deviceId}`. This is idempotent and independent devices do not collide:
   ```typescript
   export interface ReviewLog {
     id: string;
     cardKey: string;
     kind: 'review' | 'keyframe';
     rating?: 1 | 2 | 3 | 4;
     at: number;
     state?: CardState;
     deviceId: string;
   }
   ```
2. **Arrival-Order Independent Fold (`foldCard`):**
   Logs are sorted by `(at, _hlc, id)`. The latest keyframe resets state, and only subsequent reviews apply on top:
   ```typescript
   export function foldCard(logs: Array<ReviewLog & SyncStamp>, sched: Scheduler): CardState | undefined {
     const sorted = [...logs].sort(logOrder);
     let start = -1;
     sorted.forEach((l, i) => { if (l.kind === 'keyframe') start = i; });
     let state: CardState | undefined = start >= 0 ? sorted[start]?.state : undefined;
     for (const l of sorted.slice(start + 1)) {
       if (l.kind === 'review' && l.rating) state = sched.next(state, l.rating, l.at, l.cardKey);
     }
     return state;
   }
   ```
3. **Incremental Derived Rebuild (`rebuildCards`):** After a remote apply, recompute derived state **only** for cards in the returned `touched` set, within the same transaction.

---

## 6. Reference Implementation & Verified Test Suite

The complete architectural contracts, hook bindings, merge plugins, and FSRS migration routines are implemented and verified in the reference files:

1. **Reference Implementation:** [`docs/plans/reference/phase17-sync-sketch.ts`](file:///docs/plans/reference/phase17-sync-sketch.ts)
   - Implements `SYNC_POLICY` completeness, `withOrigin`, `originOf`, pure `LwwPlugin`, `AppendOnlyPlugin`, `CasDraftPlugin`, `findOrphans`, `foldCard`, `rebuildCards`, and `migrateStateToKeyframes`.
2. **Verification Suite:** [`docs/plans/reference/phase17-sync-sketch.test.ts`](file:///docs/plans/reference/phase17-sync-sketch.test.ts)
   - Executes against Dexie 4.4.6 on `fake-indexeddb`.
   - **All 17 tests pass:**
     - **Registry:** Policy matches Dexie schema; schema drift is detected; Kahn restore ordering puts parents before children; only derived/local-only tables are prunable.
     - **Tx Origin & Hooks:** Local writes captured and stamped; writes outside `withOrigin` rejected with `SyncScopeError`; remote apply does not echo to outbox; bypass `clear()` emits no tombstones; nested transactions inherit parent origin; identical `put()` emits nothing; append-only tables reject local mutations.
     - **Merge Convergence:** LWW converges under arbitrary delivery order; CAS converges on highest revision + deterministic conflict drafts; unknown entities and newer schemas are held without loss.
     - **Orphans:** Children arriving before parents are written and detected; resolve when parents land.
     - **Review Log / FSRS:** `foldCard` is arrival-order independent; keyframes supersede earlier reviews; legacy state migration is idempotent and derived rebuild reproduces original state.

---

## 7. Implementation Roadmap & Verification

### Stage 1: Track 17A — Declarative Policy, Pure Plugins, & `withOrigin` Hooks
1. Adopt `SYNC_POLICY` satisfies constraint in `src/domain/sync/models/SyncPolicy.ts`.
2. Implement pure `LwwPlugin`, `AppendOnlyPlugin`, and `CasDraftPlugin` in `src/domain/sync/plugins/`.
3. Implement `withOrigin` and `originOf` transaction wrappers in `src/infrastructure/db/transactionalOrigin.ts`.
4. Install Dexie hooks (`creating`, `updating`, `deleting`) with scope and failure guards.
5. Verification: Vitest unit test suite porting `phase17-sync-sketch.test.ts` to repo test harness.

### Stage 2: Track 17B — Custom Materials & Decoupled Pointer Sync
1. Register `materials`, `questions`, `quizzes`, and `documentContents` in `SYNC_POLICY`.
2. Implement `MaterialPointerSyncPayload` (~100 bytes) and `pendingHydrations` queue.
3. Implement background `HydrationManager` and Convert-on-delist protocol.
4. Verification: Multi-vault integration tests verifying custom material replication and zero-payload pointer sync.

### Stage 3: Track 17C — Granular Controls & Tombstone Suppression
1. Add `SyncCategoryPreferences` UI toggles in `SettingsScreen.tsx`.
2. Implement `origin = 'bypass'` in cache clearing and vault maintenance routines.
3. Connect category filtering to outbox hooks and inbound reconciliation.
4. Verification: Test proving local table clearing under `bypass` emits zero outbox rows and zero tombstones.

### Stage 4: Track 17D — Vault Safeguards & Keyframe FSRS Architecture
1. Migrate `flashcardReviews` to `derived` and introduce `reviewLogs` as `authoritative`.
2. Implement `migrateStateToKeyframes` and `rebuildCards` during sync initialization.
3. Build `<VaultStorageSection />` with live storage gauge, table matrix, and 7-day quarantine recovery.
4. Verification: Playwright E2E and Vitest tests asserting safe vault reset, quarantine recovery, and FSRS cross-device fold invariance.
