# Google Drive Sync Implementation Plan (Lock-Free v3)

**Status:** Approved for Implementation  
**Target:** Phase 14 — Bring-Your-Own-Storage (Google Drive Sync & Stateless Auth)  
**Related ADR:** `docs/architecture/adr/ADR-018-google-drive-appdata-sync-and-stateless-auth.md`  

---

## Architecture Summary

LunaClair is adopting a Bring-Your-Own-Storage (BYOS) model for private user data:
- **Cloudflare D1:** Retains public study packages (`shares` table and `/api/shares`). Zero private user data stored on servers.
- **Google Drive `appDataFolder`:** Private user sync store (`drive.appdata` scope, non-sensitive). Lock-free single-writer append-only journals (`journal_{hlc}_{deviceId}.json.gz`) discovered via `drive.changes.list`.
- **Authentication:** Pattern B+ stateless token exchange. Cloudflare Worker exchanges Google auth code for tokens, seals `refresh_token` using WebCrypto AES-256-GCM (`env.AUTH_MASTER_KEY` + AAD `sub`), and client stores `sealedRefreshToken` in Dexie. Zero server user tables, zero database writes for auth.
- **Local Storage:** `lunaclair_registry` master IndexedDB maps `ownerSub → physicalDbName` (`lc_vault_${uuid}`) for zero-copy anonymous-to-authenticated promotion.

---

## 5-Phase Implementation Sequence

### Phase 1: Stateless Auth Worker & Client `GoogleAuthService`
- **Estimated Time:** 3 hours
- **Scope:**
  - `worker/src/routes/auth.ts`: Add `POST /api/auth/google/token` and `POST /api/auth/google/refresh` routes using WebCrypto AES-256-GCM.
  - `src/domain/auth/models/auth.types.ts`: Define session, user profile, and sealed token interfaces.
  - `src/infrastructure/auth/google/GoogleAuthService.ts`: Implement GIS code flow with automatic silent token refresh via the Worker.
  - Store `sealedRefreshToken` in Dexie vault.

### Phase 2: Pointer Registry & Vault Namespacing
- **Estimated Time:** 2.5 hours
- **Scope:**
  - `src/infrastructure/database/registry/VaultRegistry.ts`: Master IndexedDB (`lunaclair_registry`) mapping `ownerSub` to `lc_vault_${uuid}`.
  - Zero-copy promotion: update row from `'ANONYMOUS'` to `googleSub` on first sign-in (0 bytes copied, 0 ms latency).
  - Shared device collision handling: replay outbox mutations if target vault already exists locally.

### Phase 3: Binary Gzip `GoogleDriveClient` with Changes API
- **Estimated Time:** 4 hours
- **Scope:**
  - `src/infrastructure/api/google/GoogleDriveClient.ts`:
    - Binary-safe `multipart/related` file uploads using `new Blob([metadataStr, gzipUint8Array, closingStr])` and `mimeType: "application/gzip"`.
    - Native `CompressionStream('gzip')` and `DecompressionStream('gzip')`.
    - Incremental feed consumption via `drive.changes.list(spaces='appDataFolder')`.
    - 4-step `410 Gone` cursor recovery (`getStartPageToken` → metadata `files.list` → in-memory watermark diff).
    - Quota discrimination: pause on `storageQuotaExceeded`; exponential backoff on 429/5xx.

### Phase 4: HLC, `GoogleDriveSyncTransport`, & Compactor
- **Estimated Time:** 5 hours
- **Scope:**
  - `src/domain/sync/utils/hlc.ts`: Hybrid Logical Clock utility for deterministic cross-device ordering.
  - `src/infrastructure/api/transports/GoogleDriveSyncTransport.ts`: Implement `SyncTransport` domain interface (`push`, `pull`).
  - `src/application/sync/compaction/DriveCompactor.ts`:
    - 1 MB `reserve_slot.bin` pre-allocated compaction cushion.
    - Write-ahead immutable `snapshot_{hlc}_{deviceId}.json.gz` storing `coveredJournalFileIds`.
    - 10-minute tail grace window on journal deletions.

### Phase 5: UI Integration & Verification
- **Estimated Time:** 3 hours
- **Scope:**
  - `src/app/screens/settings/SettingsScreen.tsx`: Mount `<SyncSettingsSection />` for connecting Google Drive, viewing account/quota, and manual sync triggers.
  - `src/app/bootstrap/use-cases/createSyncUseCases.ts`: Wire `GoogleDriveSyncTransport` through dependency injection without touching D1 or `/api/shares`.
  - Multi-device verification: offline mutation queuing, online flush, and remote ingestion across two browser instances.
