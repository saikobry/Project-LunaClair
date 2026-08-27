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
  - `GET /api/documents/:documentId` — public document fetch (`{ id, title, content }`), cached with `Cache-Control: public, max-age=3600`.
  - `GET /api/documents/:documentId/figures/:filename` — public figure image fetch (binary bytes + `Content-Type`), cached with `Cache-Control: public, max-age=86400`.
  - `GET /api/catalog` — public library catalog snapshot (`{ subjects, terms, subjectTerms, materials }`), cached with `Cache-Control: public, max-age=3600`. This is a **snapshot delivery endpoint, not a CRUD API** — the app fetches it on demand to surface **Available Materials** and imports individual materials on user action; no per-row write path.
  - `GET /api/catalog/materials/:id` — public **authoritative resolution** of one material plus its subject/term/subjectTerm relationships (`{ material, subject?, term?, subjectTerm? }`), **uncached** (`Cache-Control: no-store`) — import resolves against current server state, never the 30-day-cached snapshot; 404 when the material is not in the catalog. Not matched by the service worker runtime cache.
  - `GET /api/quiz` — public quiz content snapshot (`{ questions, quizzes }` in **assembled shapes**: each quiz carries `questionIds` + `items` rebuilt from the `quiz_questions` junction), cached with `Cache-Control: public, max-age=3600`. Also a snapshot delivery endpoint, not CRUD.
  - `PUT /api/documents/:documentId` — protected idempotent document ingest (requires `Authorization: Bearer <SEED_TOKEN>`).
  - `PUT /api/documents/:documentId/figures/:filename` — protected idempotent figure ingest (requires `Authorization: Bearer <SEED_TOKEN>`).
  - `PUT /api/catalog` — protected idempotent whole-catalog upsert (requires `Authorization: Bearer <SEED_TOKEN>`); rows applied in dependency order (subjects → terms → subjectTerms → materials) so FKs hold — rows within a table run concurrently (`Promise.all`, independent keys); `createdAt`/`updatedAt` server-stamped.
  - `PUT /api/quiz` — protected idempotent quiz upsert (requires `Authorization: Bearer <SEED_TOKEN>`); accepts assembled `{ questions, quizzes }`, splits quizzes into `quizzes` + `quiz_questions` rows (junction rows replaced per quiz — `items` are authoritative), applies in FK-safe order (questions → quizzes → junction); rows/quizzes within each step run concurrently, with each quiz's junction delete awaited before its inserts.
  - `POST /api/sync/push` — Ingest client sync mutation envelopes (`{ deviceId, mutations }`). Enforces idempotency via `sync_idempotency`, Model C atomic CAS optimistic versioning for `document` (`user_documents`), Model A LWW timestamp reconciliation for `highlight`, `drawing`, `flashcardReview` (`user_entities`), and Model B append-only event stream for `quizSession`. Returns `{ accepted, conflicts, rejected, serverCursor }`. `Authorization: Bearer <token>` is authoritative for user identity (JWT `sub`/`userId` or raw token string) with fallback to `x-user-id` and `'user_default'`.
  - `GET /api/sync/pull?cursor=...&limit=...` — Delta pull query on `sync_changes` where `sequence > cursor` with batch hydration from `user_documents` and `user_entities`. Returns `{ newCursor, hasMore, changes }`. Identifies user via authoritative `Authorization: Bearer <token>` or fallback headers.
- CORS: allowlist via the `CORS_ORIGINS` var (comma-separated). Empty or unset allows any requesting origin (`*`) with credentials-safe origin reflection for dev (5173/4173) and production; specified origins enforce an exact allowlist match.
- Pages integration: Cloudflare Pages reverse-proxies all `/api/*` traffic to the Worker via the edge Function in `functions/api/[[path]].ts` (Vite dev server proxies locally via `vite.config.ts`).
- Timestamps: **all D1 timestamps are ISO-8601 UTC text strings** (`YYYY-MM-DDTHH:mm:ss.sssZ`), matching the domain/Dexie representation so nothing converts formats across the API boundary. Stamped server-side via `new Date().toISOString()`; clients never send timestamps. `createdAt` is set on first insert and preserved on re-upsert (only `updatedAt` changes).
- Routing: plain `fetch` handler, no framework. Add routes in `worker/src/index.ts`.
- Types: run `npm run types:worker` (`wrangler types`) after any change to `wrangler.jsonc`; the generated `worker/worker-configuration.d.ts` is committed.
- Sync Schema (Phase 10): 4 tables defined in `worker/src/schema.ts` for bidirectional Dexie ⇄ D1 synchronization:
  - `user_documents`: User documents with LWW versioning (`user_id`, `document_id` composite PK, `version`, `title`, `content`, `updated_at`, `deleted_at`).
  - `user_entities`: Generic key-value store for domain entities (`user_id`, `entity_type`, `entity_id` composite PK, `payload`, `updated_at`, `deleted_at`).
  - `sync_changes`: Append-only change log (`sequence` autoincrement PK, `user_id`, `entity_type`, `entity_id`, `operation`, `version`, `changed_at`, indexed on `[user_id, sequence]`).
  - `sync_idempotency`: Client mutation deduplication ledger (`client_mutation_id` PK, `user_id`, `device_id`, `entity_type`, `entity_id`, `processed_at`).
- Migrations: schema is authored in `worker/src/schema.ts` (Drizzle ORM; config at root `drizzle.config.ts`). New migrations are generated with `npm run db:generate` (drizzle-kit) into `worker/migrations/` using the nested `NNNN_name/migration.sql` layout, matched via `migrations_pattern` in `wrangler.jsonc` — `wrangler d1 migrations create` is not used.

## Work Guidance

- Load the `wrangler` skill before running wrangler commands.
- Keep Worker dependencies minimal — Drizzle ORM is the allowed schema/query layer; avoid framework-level dependencies unless needed.
- Migration workflow: edit `worker/src/schema.ts` → `npm run db:generate` → `npm run db:apply:local` → verify → `npm run db:apply:remote` when ready. **Apply local first, remote later**; never edit a migration already applied on either side — fix forward with a new migration.
- Validate with `npx wrangler deploy --dry-run` before deploying.
- Local dev: `npm run dev:api` (`wrangler dev`) simulates D1 locally unless `--remote` is passed.

## Verification

- `npm run build` type-checks `worker/` via `tsconfig.worker.json`; `npm run lint` (oxlint) covers it too.
- After `npm run deploy:api`, `curl <worker-url>/health` must return `{"status":"ok","database":"connected"}`.

## Child DOX Index

- None.
