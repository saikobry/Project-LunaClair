# ADR-017 — Cloudflare CLI and Worker Workspace Modernization

## Status
Accepted

## Introduced
Phase 13 — Cloudflare Developer Platform Modernization

## Decision Scope
`worker/`, root `package.json`, root tooling, and DOX contracts.

## Decision Drivers
- **Root Tooling Collision:** Cloudflare's next-generation unified CLI (`cf`) automatically detects root `vite.config.ts` (the client React PWA) and attempts to hijack the build output using the Cloudflare Build Output Specification v0 (`.cloudflare/output/v0/config.json`), clashing with the client SPA build pipeline.
- **Legacy Wrangler Tooling:** The legacy Wrangler CLI (`wrangler.jsonc`, `wrangler` CLI dependencies) was retired in favor of the new typed programmatic configuration standard (`cloudflare.config.ts`) and `@cloudflare/vite-plugin`.
- **Monorepo Dependency Bleed:** Backend dependencies (Drizzle ORM, Drizzle Kit, `@cloudflare/workers-types`, `cf`) were mixed into the root `package.json`, obscuring client vs. worker boundaries.
- **Local Dev D1 Inconsistency:** In dual-tool setups, the CLI migration tool defaulted to `.wrangler/state/v3` while `@cloudflare/vite-plugin` defaulted to `.cloudflare/state/v3`, causing missing table runtime errors during local development unless explicitly aligned.

---

## Context
LunaClair operates a local-first React PWA alongside a Cloudflare Worker backend (`worker/`) serving as the bridge to serverless Cloudflare D1 and Workers AI. Previously, Worker configuration lived in root `wrangler.jsonc`, and npm scripts invoked `wrangler dev` and `wrangler deploy` from the repository root.

Following Cloudflare's release of the unified `cf` CLI (v1.0 beta) and `@cloudflare/vite-plugin` (v2.0 beta), LunaClair evaluated migrating from Wrangler to native Vite-based Worker development. Running `cf` directly from the repository root, however, caused autoconfig collisions with the client's Vite PWA configuration.

---

## Decision

We decouple the Cloudflare Worker into a dedicated npm workspace package (`worker/`) and adopt Cloudflare's unified `cf` CLI and `@cloudflare/vite-plugin`.

### 1. Workspace Decoupling
The root `package.json` declares `"workspaces": ["worker"]`.
- The Worker owns its own `worker/package.json` with `"type": "module"`.
- Backend dependencies (`drizzle-orm`, `drizzle-kit`, `cf`, `@cloudflare/vite-plugin`, `@cloudflare/workers-types`) are isolated within `worker/package.json`.
- Root scripts (`dev:api`, `deploy:api*`, `db:generate`, `db:apply*`, `types:worker`) delegate to the worker workspace via `-w worker`.

### 2. Programmatic Configuration (`cloudflare.config.ts`)
Legacy `wrangler.jsonc` is completely retired in favor of typed programmatic configuration in `worker/cloudflare.config.ts`:
- Defines Worker name, `nodejs_compat` compatibility flags, observability settings, and entrypoint (`./src/index.ts`).
- Uses `ctx.mode` branching for `staging` (`api-staging`, `lunaclair_staging`) and production (`api`, `lunaclair`).
- Bindings are declared programmatically using `bindings.d1(...)`, `bindings.ai(...)`, and `bindings.text(...)`.

### 3. Vite Worker Bundler (`worker/vite.config.ts`)
The Worker utilizes `@cloudflare/vite-plugin` without legacy `configPath` arguments.
- Configured with `server: { port: 8787, host: true }` to ensure dual-stack (IPv4 `127.0.0.1` and IPv6 `localhost`) binding.
- Aligns directly with the root client Vite dev proxy (`/api` → `http://localhost:8787`).

### 4. D1 Migration & Persistence Contract
- `worker/drizzle.config.ts` natively outputs migrations to `worker/migrations/`.
- Local migration commands explicitly pass `--persist-to .cloudflare/state` so `cf d1 migrations apply` and `@cloudflare/vite-plugin` miniflare simulation share the exact same SQLite database.

### 5. Official Agent Skill Alignment
The official Cloudflare agent skill (`skills/cf-cli` from `github.com/cloudflare/skills`) is installed globally, instructing coding agents to prefer `cf` CLI and `cloudflare.config.ts` for all Cloudflare platform interactions.

---

## Consequences

### Positive
- **Clean Architectural Boundary:** Client PWA and backend Worker dependencies are fully segregated.
- **Fast Vite Edge Bundling:** Worker dev server runs with Vite SSR hot-module reloading and instantaneous start times.
- **Agent Introspection:** Dev sessions expose Cloudflare's Local Explorer API (`/cdn-cgi/local/explorer/api`) for direct binding and observability query access.
- **Zero Wrangler Legacy:** Pruned 63 obsolete packages from root dependencies.

### Negative / Trade-Offs
- **CLI Workspace Limitation:** `cf` beta does not traverse parent directories for hoisted workspace packages; worker dependencies must be linked directly in `worker/node_modules/`.
- **D1 Migration Syntax:** `cf d1 migrations apply` requires database UUIDs rather than database names and requires explicit `--persist-to` flags for local simulation parity.
