# ADR-018 — Google Drive appDataFolder Sync & Stateless Auth

## Status
Accepted

## Introduced
Phase 14 — Bring-Your-Own-Storage (Google Drive appDataFolder Sync & Stateless Auth)

## Decision Scope
`src/domain/drive/`, `src/domain/vault/`, `src/domain/auth/`, `src/domain/sync/`, `src/infrastructure/api/google/`, `src/infrastructure/auth/google/`, `src/infrastructure/database/registry/`, `src/application/sync/compaction/`, `worker/src/routes/auth.ts`, `worker/src/core/crypto.ts`.

## Decision Drivers
- **Zero Server Data Footprint:** Private learning state (highlights, drawings, flashcard schedules, quiz sessions) grows monotonically. Storing private student data in serverless Cloudflare D1 creates unbounded storage liability and operational cost.
- **Privacy Sovereignty:** Students retain sovereign ownership of their academic notes and learning telemetry within their personal cloud storage.
- **iOS Standalone PWA Storage Isolation:** Mobile WebClip PWAs aggressively partition third-party cookies and storage contexts across domain boundaries, breaking standard HTTP-only cookie refresh flows.
- **Quota Deadlock Immunity:** Compacting append-only journals requires writing a consolidated snapshot before purging old journals. If a student's Google Drive storage is 100% full, the compactor faces a deadlocked allocation failure.
- **Zero-Latency Vault Promotion:** Converting an anonymous local session into an authenticated cloud-synced account must be instantaneous and immune to mid-copy failure.

---

## Context
LunaClair's Phase 10 synchronization replicated private student records into Cloudflare D1 tables (`user_documents`, `user_entities`, `sync_changes`, `sync_idempotency`). While robust, scaling private data in centralized serverless databases conflicted with the local-first philosophy and incurred perpetual cloud infrastructure overhead.

Phase 14 transitions LunaClair to a Bring-Your-Own-Storage (BYOS) architecture: Cloudflare D1 is retained exclusively for public study-package sharing (`/api/shares`), while all private user sync is routed to the user's hidden Google Drive `appDataFolder` (`drive.appdata` non-sensitive scope).

---

## Decision

We adopt a lock-free, append-only synchronization engine backed by Google Drive `appDataFolder`, coordinated via Hybrid Logical Clocks (HLC) and authenticated through a stateless cryptographic Worker gateway.

### 1. Pattern B+ Stateless Token Exchange & AES-256-GCM Token Sealing
- Cloudflare Worker exposes stateless endpoints:
  - `POST /api/auth/google/token`
  - `POST /api/auth/google/refresh`
- Google OAuth authorization code is exchanged server-side for access and refresh tokens.
- The Worker encrypts (`seal`) the `refresh_token` using WebCrypto AES-256-GCM with `env.AUTH_MASTER_KEY`, binding the user's Google subject ID (`sub`) as Additional Authenticated Data (AAD).
- The client receives the `sealedRefreshToken` and persists it inside its local Dexie vault.
- Subsequent token refreshes transmit `{ sealedRefreshToken, sub }`. The Worker validates AAD identity and unseals the token in-memory to obtain a fresh Google `accessToken`.
- **Zero Server Persistence:** The Worker stores zero user records and performs zero database writes for authentication. Tokens cannot be transplanted across different accounts due to cryptographic AAD binding.

### 2. Zero-Copy Vault Promotion via `lunaclair_registry` Pointer Database
- A lightweight master database (`lunaclair_registry`) maps logical identities (`ownerSub`) to randomly generated physical Dexie database instances (`lc_vault_${uuid}`).
- Unauthenticated users operate within an initial vault indexed under `ownerSub: 'ANONYMOUS'`.
- Upon Google sign-in, the registry updates the pointer row from `'ANONYMOUS'` to the authenticated `googleSub` in a single indexed operation.
- **Performance & Safety:** Promotion takes 0 ms and copies 0 bytes of database data, completely eliminating data migration scripts, transaction timeouts, and partial-copy corruption.
- On multi-user shared devices with an existing target vault, pending local mutations are replayed into the target vault rather than overwriting existing records.

### 3. Lock-Free Single-Writer Append-Only Journals
- Devices never overwrite shared remote files. Instead, each device writes single-writer immutable journal chunks to Google Drive `appDataFolder`:
  - Naming convention: `journal_{hlc}_{deviceId}.json.gz`
  - Encoded with native browser `CompressionStream('gzip')` and uploaded via binary multipart request.
- Remote mutation discovery uses Google Drive's `drive.changes.list(spaces='appDataFolder')`.
- Cross-device ordering is resolved deterministically using Hybrid Logical Clocks (`createHlc`, `compareHlc`), ensuring causal monotonicity across disconnected and offline devices without distributed locks.

### 4. Monotonic Incremental Synchronization & 4-Step 410 Recovery Protocol
- Local sync state tracks monotonic Google Changes page tokens (`pageToken`).
- If Google Drive invalidates the cursor (HTTP `410 Gone`), the client executes a self-healing 4-step recovery protocol without resetting local user state:
  1. Requests a fresh `getStartPageToken()` to anchor future changes.
  2. Queries a lightweight metadata-only `files.list` for all files in `appDataFolder`.
  3. Computes an in-memory diff against locally applied file IDs and device HLC watermarks.
  4. Returns the fresh anchor token alongside unapplied missing files for immediate reconciliation.

### 5. Self-Healing Compaction Engine & 1 MB `reserve_slot.bin` Storage Cushion
- To prevent journal accumulation from degrading sync performance, `DriveCompactor` consolidates journals when thresholds are crossed (> 40 journals or > 5 MB total).
- Compaction produces an immutable, write-ahead snapshot:
  - `snapshot_{hlc}_{deviceId}.json.gz`
  - Records `coveredJournalFileIds` and `watermarks`.
- Safely deletes obsolete journals outside a 10-minute tail grace window, keeping at least 2 recent journals.
- **Quota Cushion Escape Hatch:** A pre-allocated 1 MB dummy file (`reserve_slot.bin`) is created in `appDataFolder`. If a 100% full Google Drive account triggers `storageQuotaExceeded` during snapshot creation, the engine deletes `reserve_slot.bin`, writes the compacted snapshot, purges obsolete journals to free net space, and re-allocates the reserve cushion.

---

## Alternatives Considered
- **Direct Client-Side PKCE (Pattern A):** Rejected because Google Identity Services (GIS) token model only returns 1-hour access tokens without refresh tokens, requiring recurring interactive popups that block headless background synchronization.
- **Stateful Cloudflare D1 Session Tables:** Rejected because maintaining refresh tokens and user sessions in D1 would re-introduce centralized database scaling costs and server data liability.
- **Shared Dexie Database with Column-Level Tenant Separation:** Rejected due to risks of cross-tenant data leakage, complex compound indexes, and slow asynchronous data-copying routines during account transition.
- **In-Place Remote State Overwrites (`state.json`):** Rejected because Google Drive lacks atomic conditional writes across multiple clients, causing race conditions and lost updates under concurrent sync.

---

## Consequences

### Positive
- **Zero Server Data Footprint:** LunaClair holds 0 bytes of private user study data on servers, achieving $0 private storage costs.
- **Native Offline/Online Convergence:** Deterministic HLC conflict resolution and immutable journals ensure seamless offline editing and multi-device sync.
- **Zero-Copy Promotion:** Instantaneous account linking without data transfer or local IndexedDB replication overhead.
- **Deadlock-Resistant Compaction:** 1 MB reserve cushion guarantees automated self-healing even on completely exhausted cloud storage accounts.

### Negative / Trade-offs
- **External API Dependency:** Synchronization availability is tied to Google Drive API availability and Google OAuth services.
- **Sync Latency:** Propagation across peer devices is governed by client polling intervals and Google Changes API latency rather than real-time WebSockets.

---

## Related ADRs
- [ADR-004](ADR-004-dexie-indexeddb.md) — Adopt Dexie.js IndexedDB as Primary Local Database Infrastructure
- [ADR-011](ADR-011-public-application-context-and-cqrs-read-model.md) — Public Application Context, Composition Root Slices, and CQRS Read Model
- [ADR-015](ADR-015-uniform-infrastructure-module-organization.md) — Uniform Infrastructure Module Organization
- [ADR-016](ADR-016-uniform-cloudflare-worker-architecture.md) — Uniform Cloudflare Worker Architecture
