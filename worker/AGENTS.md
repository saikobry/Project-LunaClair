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
  - `GET /api/documents/:sourceId` — public document fetch (`{ id, title, content }`), cached with `Cache-Control: public, max-age=3600`.
  - `GET /api/documents/:sourceId/figures/:filename` — public figure image fetch (binary bytes + `Content-Type`), cached with `Cache-Control: public, max-age=86400`.
  - `PUT /api/documents/:sourceId` — protected idempotent document ingest (requires `Authorization: Bearer <SEED_TOKEN>`).
  - `PUT /api/documents/:sourceId/figures/:filename` — protected idempotent figure ingest (requires `Authorization: Bearer <SEED_TOKEN>`).
- CORS: allowlist via the `CORS_ORIGINS` var (comma-separated). Empty or unset allows any requesting origin (`*`) with credentials-safe origin reflection for dev (5173/4173) and production; specified origins enforce an exact allowlist match.
- Timestamps: `updatedAt` is always stamped server-side; clients never send timestamps.
- Routing: plain `fetch` handler, no framework. Add routes in `worker/src/index.ts`.
- Types: run `npm run types:worker` (`wrangler types`) after any change to `wrangler.jsonc`; the generated `worker/worker-configuration.d.ts` is committed.
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
