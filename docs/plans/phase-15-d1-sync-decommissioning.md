# Phase 15 Plan: D1 Private Sync Decommissioning & Zero-Server-Footprint Purge

**Studio:** Saiko Interactive  
**Project:** LunaClair  
**Objective:** Immediately decommission Cloudflare D1 private sync tables and Worker `/api/sync/*` routes, standardizing exclusively on Google Drive BYOS sync (`appDataFolder`) and retaining D1 exclusively for public `.lcpack` study-package sharing (`/api/shares`).  
**Directive:** Immediate zero-server-footprint purge (no sunset delay). Sync becomes purely client-managed via Google Drive BYOS, ensuring zero user data ever touches Cloudflare D1.  
**Execution Mandate (100% Local-First):** Phase 15 is executed strictly in local development. Zero remote database or worker commands (`--remote`, `deploy:api`, `db:apply:production`, `db:apply:staging` strictly omitted). D1 migration applies strictly to local (`npm run db:apply:local`). All client and worker verification runs locally. The canonical seeder (`scripts/seed-shares.mjs` / `content/**`) is the single source of truth for shares; no remote D1 backup is required or performed.

---

## 1. Decommissioning Scope

### Target Tables to Drop from D1:
1. `sync_idempotency` (D1 deduplication ledger)
2. `sync_changes` (D1 global change sequence journal)
3. `user_entities` (D1 opaque JSON LWW/append replica table)
4. `user_documents` (D1 versioned document CAS replica table)

### Target Endpoints to Remove from Worker:
1. `POST /api/sync/push`
2. `GET /api/sync/pull`

### Retained D1 Surface (Untouched):
- `shares` (Public & unlisted `.lcpack` study packages and metadata)
- `d1_migrations` (D1 internal migration ledger)

---

## 2. Sequencing Order & 4-Stage Rollout

> [!IMPORTANT]
> **Strict Sequencing Invariant: Worker First, Migration Second (Local Execution).**  
> Worker `/api/sync/*` routes must be decommissioned and verified *before* applying the local D1 migration. If D1 tables were dropped while Worker sync routes were live in local dev or tests, incoming requests would trigger uncaught SQLite `no such table` runtime 500 errors. Removing Worker routes first guarantees all retired sync endpoints cleanly return deterministic JSON 404 responses immediately.
> 
> **Zero Remote Commands Invariant (100% Local-First):**
> Remote database and worker commands (`--remote`, `npm run deploy:api`, `npm run db:apply:production`, `npm run db:apply:staging`) are strictly omitted for this phase. All D1 migrations apply to local state only (`npm run db:apply:local`). The canonical seeder (`scripts/seed-shares.mjs` / `content/**`) is the sole source of truth for shares; no D1 pre-purge remote backup is performed.

### Stage 1: Client Cutover, Standby Gating & Multi-Tab Fencing
- **Goal:** Route client sync exclusively through Google Drive BYOS, eliminate guest fallbacks, implement multi-tab Web Locks fencing, and baseline seed historical Dexie data.
- **Actions:**
  1. **Two-Layer Unauthenticated Gating:**
     - **Lifecycle Gate (Outer):** `AppShell` and `BrowserSyncLifecycle` omit window event listeners (`online`, `visibilitychange`, timers) when unauthenticated; sync engine remains dormant.
     - **Engine Gate (Inner):** `SyncEngine.sync()` short-circuits immediately to `'standby'` status when Google credentials or active session are missing; local Dexie mutations remain queued.
  2. **Delete Fallback Guest Credentials (`'user_default'`):**
     - Remove hardcoded guest fallback (`userId: 'user_default'`, `token: 'guest_token'`) in `LocalStorageCredentialsProvider`. Return `null` when unauthenticated.
  3. **Multi-Tab Web Locks Fencing:**
     - Implement single-leader mutex via `navigator.locks.request` with `{ ifAvailable: true }`.
     - Inactivity watchdog (30s) reset on `reportProgress()`.
     - Page lifecycle listeners (`pagehide`, `freeze`) triggering `AbortController` cancellation.
     - Heartbeat with `{ steal: true }` fallback (45s threshold) for frozen Chrome background tabs.
  4. **Vault Baseline Seeding (`driveSeeded` Barrier):**
     - Paginated cursor read across Dexie stores into gzipped snapshot (`snapshot_${hlc}_${deviceId}.json.gz`) on cold remote.
     - Pull-then-seed with local deltas on warm remote.
     - Commit `driveSeeded: true` to Dexie `syncState` upon verified upload confirmation.
  5. **UI Refinements in 'standby':**
     - Suppress pending mutations badge in `SyncStatusPill` when state is `'standby'`.
     - Route manual "Sync Now" clicks in `SyncSettingsSection` and pill to Google Drive connect flow when unauthenticated.

### Stage 2: Immediate Worker Route Removal (Worker First, Local Only)
- **Goal:** Unbind and delete Worker `/api/sync/*` routes, run local worker tests, and verify non-matching `/api/*` JSON 404s before modifying the database.
- **Actions:**
  1. **Delete Route & Protocol Tests:**
     - Delete `worker/src/routes/sync.ts`.
     - Delete `worker/src/__tests__/syncProtocol.test.ts`.
  2. **Unbind from Router:**
     - Remove `/api/sync/push` and `/api/sync/pull` route handlers from `worker/src/router.ts` and `worker/src/index.ts`.
  3. **Local Route Verification (`Worker First`):**
     - Run Worker test suite locally: `npx vitest run worker/`.
     - Omit remote deployment: `npm run deploy:api` strictly deferred.
  4. **Verify Deterministic JSON 404:**
     - Verify `POST /api/sync/push` and `GET /api/sync/pull` return JSON 404 (`{"error": "NOT_FOUND"}`) in local tests and `npm run dev:api` instead of falling back to SPA HTML 200 or 500 error.

### Stage 3: Local D1 Forward Migration (Migration Second, Local Only)
- **Goal:** Append a forward Drizzle migration dropping private sync tables, apply strictly to local D1, and verify local D1 post-drop integrity.
- **Actions:**
  1. **Seeder Source of Truth (No Remote Backup):**
     - Omit remote D1 backup/export. Canonical course definitions in `content/**` and seeder (`scripts/seed-shares.mjs`) are the definitive source of truth for shares.
  2. **Foreign Key Audit:**
     - Verify `shares` table DDL has no foreign key dependencies or triggers referencing `user_documents` or `user_entities`.
  3. **Append Forward Drizzle Migration:**
     - Remove `syncIdempotency`, `syncChanges`, `userEntities`, and `userDocuments` from `worker/src/schema.ts`.
     - Generate forward migration: `npm run db:generate`.
     - *Invariant:* Never delete or alter historical migration files in `worker/migrations/`; forward migration appends:
       ```sql
       DROP TABLE IF EXISTS `sync_idempotency`;
       DROP TABLE IF EXISTS `sync_changes`;
       DROP TABLE IF EXISTS `user_entities`;
       DROP TABLE IF EXISTS `user_documents`;
       ```
  4. **Apply Migration Locally:**
     - Apply strictly to local D1: `npm run db:apply:local`.
     - Omit remote targets (`npm run db:apply:staging` and `npm run db:apply:production` strictly omitted).
  5. **Post-Drop Local Verification:**
     - Query local D1 table list to confirm only `shares` and `d1_migrations` exist.
     - Smoke test local `/api/shares` routes to confirm operational integrity.

### Stage 4: Dead-Code Purge, DOX Updates & Verification
- **Goal:** Remove client sync transport dead code, update DOX hierarchy, and run full test suites.
- **Actions:**
  1. **Client Dead-Code Purge:**
     - Delete `src/infrastructure/api/transports/WorkerSyncTransport.ts` and `src/infrastructure/api/transports/__tests__/WorkerSyncTransport.test.ts`.
     - Verify `createInfrastructure.ts` configures `googleDriveSyncTransport` as the exclusive transport.
  2. **DOX Updates:**
     - Update `worker/AGENTS.md`: reflect `shares` as sole application table; remove `/api/sync/*` contracts.
     - Update root `AGENTS.md` and `src/infrastructure/AGENTS.md`: document Google Drive BYOS as exclusive sync provider.
  3. **Verification Suite:**
     - Run client unit & integration tests: `npm run test:run`.
     - Run Worker unit tests: `npx vitest run worker/`.
     - Run linter: `npm run lint`.
     - Run production build: `npm run build`.

---

## 3. Baseline Seeding Specification

### Cold Remote vs. Warm Remote
1. **Cold Remote Detection:**
   - On first Google Drive sync, check if `appDataFolder` contains any existing snapshot or journal files.
   - If cold (0 remote sync files): format snapshot as `snapshot_${hlc}_${deviceId}.json.gz` containing all existing local Dexie records.
2. **Warm Remote Detection:**
   - If existing journals/snapshots exist on remote (from another configured device): execute `pull()` first to hydrate remote state into local Dexie.
   - Seed only genuine local deltas as standard `journal_${hlc}_${deviceId}.json.gz` to prevent clobbering peer changes.

### Dexie Cursor Pagination & Chunking
- **Primary-Key Cursor Pagination:**
  - Query across local Dexie stores (`documents`, `highlights`, `drawings`, `flashcards`, `quizProgress`):
    ```typescript
    table.where(':id').above(lastKey).limit(100)
    ```
  - Prevents high memory allocation and avoids browser heap pressure during initial large-vault export.
- **Streaming Compression & Size Envelope:**
  - Pipe streaming uncompressed JSON chunks into `CompressionStream('gzip')`.
  - Enforce a 3.5 MB uncompressed chunk ceiling.
  - Guarantees compressed gzip payload remains <800 KB:
    - Strictly honors the 1 MB `reserve_slot.bin` deadlock-breaker cushion.
    - Stays well below the Google Drive 5 MB simple upload ceiling (avoiding complex resumable multipart sessions).

### HLC Timestamp Mapping
- Map per-entity HLC timestamps directly from entity `updatedAt` (or `createdAt` if absent).
- Preserves historical causal ordering and ensures LWW conflict resolution accurately respects historical edit times.

### Crash-Safe Atomic Barrier
- Write an in-progress barrier record in Dexie's per-vault `syncState` table before initiating the upload.
- Mark `driveSeeded: true` in `syncState` only after Google Drive returns an HTTP 200 confirmation for the snapshot.
- If a crash, refresh, or network timeout occurs mid-upload, the uncommitted barrier causes the next sync cycle to resume or re-seed idempotently.

---

## 4. Web Locks Multi-Tab Fencing Specification

### Single-Leader Mutex (`navigator.locks`)
- Multi-tab synchronization is coordinated via the Web Locks API:
  ```typescript
  await navigator.locks.request('lunaclair_sync_mutex', { ifAvailable: true }, async (lock) => {
    if (!lock) {
      // Another tab holds the lock; exit immediately without competing or queueing
      return;
    }
    await executeSyncCycle();
  });
  ```
- Fast non-blocking return when `lock === null` prevents thundering-herd problems and lock congestion across tabs.

### Inactivity Watchdog
- A 30-second watchdog timer monitors the active sync cycle.
- Each progress event (e.g. `reportProgress()` during cursor pagination, chunk compression, or network upload) resets the 30s timer.
- If an operation hangs or an unhandled promise stalls, the watchdog trips, aborts the cycle, and releases mutex resources.

### Tab Freeze & Pagehide Cleanup
- Attach listeners to `window` for `pagehide` and `freeze` events (Page Lifecycle API).
- Immediately signal an internal `AbortController` to abort ongoing fetch streams and compression tasks, releasing the Web Lock before the browser terminates or freezes the tab.

### Heartbeat & Steal Fallback
- Chrome background tab throttling can freeze execution while keeping Web Locks alive, causing lock starvation for active foreground tabs.
- Active sync leader maintains a periodic timestamp heartbeat in shared storage (`localStorage` / `BroadcastChannel`).
- If an active tab requests the lock and detects a stale heartbeat exceeding the 45-second threshold, it invokes `navigator.locks.request` with `{ steal: true }` to recover the mutex safely.

---

## 5. Rollback Strategy & Verification Matrix

### Rollback Mechanisms:
1. **Seeder Rehydration:** The canonical seeder (`scripts/seed-shares.mjs` / `npm run seed:shares:local`) is the single source of truth for study package shares. Any local D1 state can be rehydrated or re-seeded on demand.
2. **Git Reversion:** Client transports and Worker routes restorable via git commit rollback.
3. **Zero Remote Risk:** Because changes are 100% local, remote databases and production workers remain completely untouched.

### Post-Drop Verification Commands (Local Environment):
| Verification Target | Command | Expected Output |
|---------------------|---------|-----------------|
| Local D1 Migration | `npm run db:apply:local` | Migration executes cleanly with 0 errors |
| Local Table Catalog | `npx wrangler d1 execute lunaclair --local --command="SELECT name FROM sqlite_master WHERE type='table';"` | Only `shares` & `d1_migrations` |
| Local Table PRAGMA List | `npx wrangler d1 execute lunaclair --local --command="PRAGMA table_list;"` | No `sync_*` or `user_*` entries |
| Worker Unit Tests | `npx vitest run worker/` | All worker unit tests pass |
| Client Test Suite | `npm run test:run` | All unit & integration tests pass |
| Local Worker Sync 404 | `curl -i -X POST http://localhost:8787/api/sync/push` | HTTP 404 with JSON error (with `npm run dev:api`) |
| Local Explore Shares | `curl -i http://localhost:8787/api/shares` | HTTP 200 with shares catalog (with `npm run dev:api`) |

---

## 6. Acceptance Criteria

- [ ] Strict sequencing followed: Worker route decommission verified locally *before* D1 migration execution.
- [ ] 100% Local-first scope enforced: zero remote database or worker commands executed (`--remote`, `deploy:api`, `db:apply:production`, `db:apply:staging` strictly omitted).
- [ ] Seeder recognized as single source of truth for shares; no pre-purge remote backup performed.
- [ ] Two-layer unauthenticated gating active: lifecycle dormant and engine short-circuits to `'standby'`.
- [ ] Fallback guest credentials (`user_default`) removed from `LocalStorageCredentialsProvider`.
- [ ] Web Locks single-leader mutex implemented with `{ ifAvailable: true }`, 30s watchdog, `pagehide`/`freeze` aborts, and 45s `{ steal: true }` fallback.
- [ ] Baseline seeding specification implemented: cold vs warm detection, Dexie cursor pagination (`table.where(':id').above(lastKey).limit(100)`), 3.5 MB uncompressed ceiling (<800 KB compressed), entity HLC mapping, and crash-safe `driveSeeded` barrier.
- [ ] Pending count badge suppressed in `'standby'`; manual "Sync Now" routes to Google Drive connect when unauthenticated.
- [ ] Historical migration files preserved; forward migration cleanly drops `sync_idempotency`, `sync_changes`, `user_entities`, and `user_documents`.
- [ ] Post-drop verification on local D1 (`npm run db:apply:local`) confirms only `shares` and `d1_migrations` exist.
- [ ] `worker/src/routes/sync.ts` and `worker/src/__tests__/syncProtocol.test.ts` deleted.
- [ ] `/api/sync/*` unlinked from router; returns JSON 404.
- [ ] `WorkerSyncTransport` and test files completely deleted from client codebase.
- [ ] `/api/shares` publishing, exploration, and cloning verified with zero regressions.
- [ ] DOX documentation updated (`AGENTS.md`, `worker/AGENTS.md`, `src/infrastructure/AGENTS.md`).
- [ ] 0 oxlint warnings or errors; clean production build; all tests passing.
