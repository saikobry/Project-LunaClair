# Worker — Cloudflare API for LunaClair

## Purpose

- The `api` Cloudflare Worker (`https://api.project-lunaclair.workers.dev`) is the only bridge between the LunaClair PWA and Cloudflare D1 (serverless SQLite).
- Browser code never calls D1 directly; all cloud data flows through this Worker's HTTP API.

## Ownership

- This Worker owns the D1 schema, migrations, and the REST API contract for cloud sync and content distribution.

## Local Contracts

- Config: root `wrangler.jsonc` — Worker name `api`, D1 binding `DB` (database `lunaclair`), migrations dir `./worker/migrations`, `nodejs_compat` enabled.
- Endpoints:
  - `GET /health` — liveness + D1 connectivity probe (503 when D1 is unreachable).
  - `POST /api/sync/push` — Ingest client sync mutation envelopes (`{ deviceId, mutations }`). Each mutation supplies `clientTimestamp`, which drives Model A LWW timestamp reconciliation for `highlight`, `drawing`, `flashcardReview` (`user_entities`). Enforces idempotency via `sync_idempotency`, Model C atomic CAS optimistic versioning for `document` (`user_documents`), and Model B append-only event stream for `quizSession`. Returns `{ accepted, conflicts, rejected, serverCursor }`. `Authorization: Bearer <token>` is authoritative for user identity (JWT `sub`/`userId` or raw token string) with fallback to `x-user-id` and `'user_default'`. It also carries the idempotency-ledger retention pass (see the retention contract below), best-effort so it can never fail an otherwise successful push.
  - `GET /api/sync/pull?cursor=...&limit=...` — Delta pull query on `sync_changes` where `sequence > cursor` with batch hydration from `user_documents` and `user_entities`. Returns `{ newCursor, hasMore, changes }`. Identifies user via authoritative `Authorization: Bearer <token>` or fallback headers.
  - `POST /api/shares` — Publish a StudyPackage snapshot payload to Cloudflare D1. Validates package format (`lcpack`), schemaVersion (`1`), prefix naming, foreign key relational integrity, asset references, and material `tags` (optional `string[]`). Enforces 5 MB payload limit. Supports `accessType: 'public' | 'unlisted' | 'passcode'`. Passcodes are hashed with SHA-256 before persistence. Returns `{ id, format, schemaVersion, title, accessType, shareUrl, createdAt }`.
  - `GET /api/shares` — Public discovery feed endpoint (`handleListPublicShares`). Filters strictly on `access_type = 'public'` and non-expired shares. Projects lightweight summary (`id, format, schemaVersion, title, description, author, viewCount, downloadCount, createdAt`) without the full JSON payload. Supports text search `q`, sorting (`popular` | `recent`), limit capping (1-50, default 20), and opaque base64 keyset cursor pagination (`nextCursor`, `hasMore`).
  - `GET /api/shares/:id` — Resolve a published StudyPackage snapshot. Verifies expiration and passcode (via constant-time XOR comparison with `X-Share-Passcode` header). Increments `viewCount` atomically and returns `{ id, format, schemaVersion, title, description, author, accessType, package, viewCount, downloadCount, createdAt, updatedAt }`.
  - `POST /api/shares/:id/download` — Increment download counter on a published share.
  - `DELETE /api/shares/:id` — Delete a published share. Enforces creator ownership via `Authorization: Bearer <token>` / `x-user-id` or seed token.
- CORS: allowlist via the `CORS_ORIGINS` var (comma-separated). Empty or unset allows any requesting origin (`*`) with credentials-safe origin reflection for dev (5173/4173) and production; specified origins enforce an exact allowlist match.
- Pages integration: Cloudflare Pages reverse-proxies all `/api/*` traffic to the Worker via the edge Function in `functions/api/[[path]].ts` (Vite dev server proxies locally via `vite.config.ts`).
- Timestamps: **all D1 timestamps are ISO-8601 UTC text strings** (`YYYY-MM-DDTHH:mm:ss.sssZ`), matching the domain/Dexie representation so nothing converts formats across the API boundary. Stamped server-side via `new Date().toISOString()`; the one client-supplied exception is the sync push `clientTimestamp`, which drives Model A LWW reconciliation (server time is the fallback when absent). `createdAt` is set on first insert and preserved on re-upsert (only `updatedAt` changes).
- Routing & Architecture (ADR-016):
  - Zero-framework, layered architecture using native Web Standards (`Request`, `Response`, `URLPattern`/segment matching).
  - `worker/src/index.ts` is a slim composition root (<30 lines) orchestrating CORS preflight, header computation, router dispatch, and global 500 error boundary.
  - `worker/src/router.ts` is the declarative router mapping method + path to route handlers, extracting params into typed `RouteContext`, and enforcing 404 Not Found and 405 Method Not Allowed (with `Allow` header).
  - `worker/src/core/` houses foundational primitives: `cors.ts` (origin reflection), `responses.ts` (typed HTTP responses), `security.ts` (timing-safe comparison, bearer token parsing, user resolution, passcode hashing), `path.ts` (anti-traversal segment decoding, cross-realm binary conversion), and `types.ts` (`Env`, `RouteContext`, `RouteHandler`).
  - `worker/src/routes/` houses focused endpoint handlers: `health.ts`, `ai.ts`, `sync.ts`, `shares.ts` (the retired `documents.ts`/`figures.ts` handlers were removed with the Phase 12 catalog retirement).
  - Zero barrels: direct file imports only within `worker/src/`.
- Types: run `npm run types:worker` (`wrangler types`) after any change to `wrangler.jsonc`; the generated `worker/worker-configuration.d.ts` is committed.
- Schema: 5 tables defined in `worker/src/schema.ts` for sync and sharing (`user_documents`, `user_entities`, `sync_changes`, `sync_idempotency`, `shares`; the legacy content tables — `documents`, `figures`, and the catalog/quiz tables `subjects`, `terms`, `subject_terms`, `materials`, `questions`, `quizzes`, `quiz_questions` — were dropped in the Phase 12 catalog retirement, migration `20260906121438_curious_lake`):
  - `user_documents`: User documents with CAS optimistic versioning (`user_id`, `document_id` composite PK, `version`, `title`, `content`, `updated_at`, `deleted_at`).
  - `user_entities`: Generic key-value store for domain entities (`user_id`, `entity_type`, `entity_id` composite PK, `payload`, `updated_at`, `deleted_at`).
  - `sync_changes`: Append-only change log (`sequence` autoincrement PK, `user_id`, `entity_type`, `entity_id`, `operation`, `version`, `changed_at`, indexed on `[user_id, sequence]`).
  - `sync_idempotency`: Client mutation deduplication ledger (`client_mutation_id` PK, `user_id`, `device_id`, `entity_type`, `entity_id`, `processed_at`), indexed on `processed_at` for retention pruning — nothing reads the ledger by time.
  - `shares`: Published StudyPackage snapshots (`id` PK `share_*`, `format`, `schema_version`, `title`, `description`, `author`, `access_type`, `passcode_hash`, `package_payload`, `user_id`, `view_count`, `download_count`, `expires_at`, `created_at`, `updated_at`).
- Migrations: schema is authored in `worker/src/schema.ts` (Drizzle ORM; config at root `drizzle.config.ts`). New migrations are generated with `npm run db:generate` (drizzle-kit) into `worker/migrations/` using the nested `NNNN_name/migration.sql` layout, matched via `migrations_pattern` in `wrangler.jsonc` — `wrangler d1 migrations create` is not used. Each migration directory also carries the `snapshot.json` baseline it was generated against, and those snapshots are what the next `db:generate` diffs from — commit them with the migration.
- **Idempotency-ledger retention: 30 days, pruned on the push path.** `sync_idempotency` is the one sync table that grows with traffic and is never otherwise reclaimed, so `core/retention.ts` retires entries older than `SYNC_IDEMPOTENCY_RETENTION_DAYS` (30) in bounded batches (`SYNC_IDEMPOTENCY_PRUNE_BATCH`, 500) served by `idx_sync_idempotency_processed_at`. The window must outlive the longest plausible replay delay, which is bounded by how long a client can hold an unsent mutation — its outbox drains whenever the app runs with connectivity — and the cutoff is generated in the same fixed-width ISO-8601 UTC text the ledger stores rather than through SQL date functions. **After expiry the ledger is not the only guard**, which is what makes expiring safe: a replayed `document` mutation fails its CAS or finds the row already present and returns a conflict, a replayed `highlight`/`drawing`/`flashcardReview` carries the timestamp the stored row holds and is rewritten with the same payload (one redundant `sync_changes` row, no data change), and a replayed `quizSession` finds its entity and is accepted without a second insert. Expiry therefore costs log noise and a conflict response, never duplicated data. Pruning rides `handleSyncPush` — the only traffic that can add rows — instead of a cron trigger, so there is no deployment configuration to keep in sync and an idle account's ledger stops growing rather than being swept. It runs only when the request processed at least one mutation, is bounded to one batch per push, and is best-effort: the mutations are already committed, so a prune failure is logged (`sync_idempotency prune failed:`) and never surfaces as a push error, while a pass that retires rows logs its count. `worker/src/core/__tests__/retention.test.ts` asserts the window floor, the bound, and the statement's semantics against real SQLite (`node:sqlite`, Node >= 22.5) — including that the plan uses the index — because a wrong prune here is a data-loss shape, not a performance one.

## Work Guidance

- Load the `wrangler` skill before running wrangler commands.
- Keep Worker dependencies minimal — Drizzle ORM is the allowed schema/query layer; avoid framework-level dependencies unless needed.
- Migration workflow: edit `worker/src/schema.ts` → `npm run db:generate` → `npm run db:apply:local` → verify → `npm run db:apply:remote` when ready. **Apply local first, remote later**; never edit a migration already applied on either side — fix forward with a new migration. **Remote is currently frozen by user decision (2026-09-18)** — pending migrations stack up there and applying them runs the legacy-table drop; see the PWA/Cloudflare section in the root `AGENTS.md` before touching `--remote` or `deploy:api`.
- Validate with `npx wrangler deploy --dry-run` before deploying.
- Local dev: `npm run dev:api` (`wrangler dev`) simulates D1 locally unless `--remote` is passed.

## Verification

- `npm run build` type-checks `worker/` via `tsconfig.worker.json`; `npm run lint` (oxlint) covers it too.
- After `npm run deploy:api`, `curl <worker-url>/health` must return `{"status":"ok","database":"connected"}`.

## Child DOX Index

- None.
