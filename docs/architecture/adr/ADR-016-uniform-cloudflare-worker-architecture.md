# ADR-016 — Uniform Cloudflare Worker Architecture

## Status
Accepted

## Introduced
Phase 12 — Architecture & Domain Standardization

## Decision Scope
`worker/`

## Decision Drivers
- **Monolithic Entry Point**: `worker/src/index.ts` has grown into a 702-line monolith mixing routing, CORS reflection, crypto token checks, document storage, binary figure byte parsing, catalog transaction cascades, quiz assembly, and health probes in a single switch block.
- **Mixed HTTP and Domain Concerns**: Route handlers directly interleave HTTP wire concerns (path parsing, header validation, status codes) with low-level D1 SQL/Drizzle queries, foreign key transaction ordering, and domain assembly rules.
- **Ad-Hoc Route Matching**: Endpoint routing relies on disparate string prefixes (`startsWith`) and manual regex splits rather than a centralized, declarative dispatch mechanism.
- **Uneven Endpoint Test Coverage**: While `sync` and `shares` possess integration suites, `catalog`, `documents`, `figures`, `quiz`, and `health` lack dedicated test coverage at the Worker layer.
- **Framework Constraint**: `worker/AGENTS.md` mandates zero heavy framework dependencies (e.g. Hono, Express) to ensure minimal bundle size, instant edge cold-start latency, and pure Web Standards compatibility.

---

## Context

The LunaClair Cloudflare Worker (`api`) is the sole bridge connecting the local-first client application to serverless Cloudflare D1 storage. Over successive phases (Catalog Ingestion, Documents & Figures, Spaced Repetition, Cloud Sync, and Cloud Sharing), new capabilities were incrementally appended directly into `worker/src/index.ts` or standalone sibling files (`sync.ts`, `shares.ts`).

While the domain and infrastructure layers on the client side were systematically hardened by ADR-010 (Direct Imports), ADR-012 (1:1 Primary Tests), ADR-013 (Domain Module Organization), and ADR-015 (Infrastructure Organization), the backend Worker accumulated structural debt. The monolithic `index.ts` makes adding or modifying endpoints risky, obscures architectural boundaries, and impairs test discoverability.

---

## Decision

We establish a **Zero-Framework, Web Standards-Based Layered Architecture** for `worker/src/`.

### Core Architectural Separation
HTTP transport concerns are strictly separated from domain/application operations:

```text
Request (HTTP)
    │
    ▼
index.ts (CORS, Error Boundary, Environment Binding)
    │
    ▼
router.ts (Declarative Path Matching, Method Dispatch, 404/405)
    │
    ▼
routes/<domain>.ts (Route Handler: HTTP Request Parsing & Validation)
    │
    ▼
Domain / Application Operations (Transaction Orchestration, Business Rules)
    │
    ▼
Drizzle ORM / Cloudflare D1 (Schema & SQL Persistence)
    │
    ▼
core/responses.ts (Standardized Typed HTTP Responses)
    │
    ▼
Response (HTTP)
```

No route handler may interleave URL pattern parsing, authentication crypto, transaction cascades, domain assembly, and response serialization in an ad-hoc fashion.

---

## Target Module Organization

```
worker/src/
  ├── core/                   — Domain-agnostic HTTP & security primitives
  │   ├── cors.ts             — Origin reflection, CORS response headers, preflight
  │   ├── responses.ts        — Standardized typed JSON/binary/error response helpers
  │   ├── security.ts         — Constant-time token comparison, Bearer token extraction
  │   ├── path.ts             — Traversal-safe URL segment decoding
  │   └── types.ts            — Env, RouteContext, RouteHandler type definitions
  │
  ├── routes/                 — Endpoint-level route adapters (HTTP ↔ Domain)
  │   ├── health.ts           — GET /health (Liveness + D1 connectivity probe)
  │   ├── documents.ts        — GET /api/documents/:id, PUT /api/documents/:id
  │   ├── figures.ts          — GET/PUT /api/documents/:id/figures/:filename
  │   ├── catalog.ts          — GET/PUT /api/catalog, GET /api/catalog/materials/:id
  │   ├── quiz.ts             — GET/PUT /api/quiz (relational junction assembly)
  │   ├── sync.ts             — POST /api/sync/push, GET /api/sync/pull
  │   └── shares.ts           — POST/GET/DELETE /api/shares endpoints
  │
  ├── router.ts               — Declarative URL pattern dispatcher & method router
  ├── schema.ts               — Drizzle ORM schema (preserved for drizzle-kit compatibility)
  ├── index.ts                — Composition root (<50 lines: CORS + Router + Global Error Boundary)
  │
  └── __tests__/              — Contract integration tests against worker.fetch()
      ├── health.test.ts
      ├── documents.test.ts
      ├── figures.test.ts
      ├── catalog.test.ts
      ├── quiz.test.ts
      ├── syncProtocol.test.ts
      └── sharesEndpoint.test.ts
```

---

## Architectural Contracts

### 1. Composition Root Contract (`index.ts`)
* `index.ts` is purely an entry orchestrator and must not exceed 50 lines.
* Exposes `export default { fetch(request: Request, env: Env): Promise<Response> }` adhering to the Cloudflare Worker module contract.
* Handles global CORS preflight (`OPTIONS`) uniformly before routing.
* Catches all unhandled exceptions at the top level and translates them into sanitized HTTP `500` responses with appropriate CORS headers.

### 2. Router Contract (`router.ts`)
* Serves as the single route-dispatch authority for all incoming requests.
* Declarative route table mapping HTTP methods and URL patterns to typed route handlers:
  $$\text{RouteHandler}: (request: \text{Request}, env: \text{Env}, ctx: \text{RouteContext}) \rightarrow \text{Promise}<\text{Response}>$$
* Encapsulates route precedence: exact literal paths evaluate before parameterized routes (e.g. `/api/catalog/materials/:id` matches before `/api/catalog`).
* Semantic HTTP status handling:
  * Returns `405 Method Not Allowed` with an `Allow` header if the path matches a route but the HTTP method is unsupported.
  * Returns `404 Not Found` when no route pattern matches.

### 3. Route Handler Contract (`routes/*.ts`)
* Each route module owns a single bounded domain (e.g. `catalog`, `documents`, `quiz`, `shares`, `sync`).
* Route handlers are endpoint adapters: they parse HTTP requests, validate input shapes, invoke D1/Drizzle persistence operations, and format HTTP responses.
* **Zero Cross-Route Coupling**: No route module may import from another route module. Shared HTTP logic belongs strictly in `core/`; shared persistence models belong in `schema.ts`.
* Existing business rules and transaction logic in `sync.ts` and `shares.ts` are preserved and organized within their respective route modules.

### 4. Core Primitives Contract (`core/`)
* **`cors.ts`**: Implements credentials-safe origin reflection, validating against `env.CORS_ORIGINS` (comma-separated allowlist). When unset, reflects requesting origin or defaults to `*`.
* **`responses.ts`**: Pure helper functions returning standardized `Response` instances:
  * `json(body, status, headers)` — standard UTF-8 JSON response.
  * `binary(bytes, contentType, headers)` — binary payload (figures).
  * `badRequest(message)` — 400 with structured JSON error.
  * `unauthorized(message)` — 401 with structured JSON error.
  * `forbidden(message)` — 403 with structured JSON error.
  * `notFound(message)` — 404 with structured JSON error.
  * `conflict(message)` — 409 with structured JSON error.
  * `payloadTooLarge(message)` — 413 with structured JSON error.
  * `serverError(message)` — 500 with sanitized message.
* **`security.ts`**:
  * Implements timing-safe comparison (`crypto.subtle.timingSafeEqual`) for all secret validation (`SEED_TOKEN`, share passcodes) to prevent timing side-channel attacks.
  * Authoritative user identity resolution: extracts user ID from `Authorization: Bearer <token>` (JWT parsing with fallback to raw token string), falling back to `x-user-id` and `'user_default'`.
* **`path.ts`**:
  * Decodes URL path segments (`decodeSegment`) and rejects directory traversal attempts (`..`, `/`, `\`). Guarantees composite key isolation so one document cannot access another document's assets.

---

## Error Boundary & Security Policy

1. **Expected Application Errors**: Validation failures, missing entities, unauthorized tokens, expired shares, or version conflicts must return structured HTTP errors (`400`, `401`, `403`, `404`, `409`, `413`) with clear, machine-readable JSON payloads:
   ```json
   { "error": "Material with id 'mat-123' not found in catalog" }
   ```
2. **Unexpected Internal Exceptions**: Caught by the outer `index.ts` error boundary, logged to the Worker console, and returned as a sanitized `500 Internal Server Error`:
   ```json
   { "error": "Internal server error" }
   ```
   **Security Invariant**: Never expose raw SQLite/D1 syntax errors, database constraints, table structures, or runtime stack traces to the client.
3. **CORS on Errors**: All error responses (including 404, 405, and 500) must attach appropriate CORS headers so client fetch calls receive actionable responses rather than browser CORS network blocks.

---

## Dependency Rules

```text
index.ts ──► router.ts ──► routes/*.ts ──► schema.ts (Drizzle ORM)
   │            │              │
   ▼            ▼              ▼
   └────────────┴──────► core/*.ts
```

* `core/` imports only from standard Web APIs (`crypto`, `Response`, `URL`) and `schema.ts` (if needed for shared types). It never imports from `routes/` or `router.ts`.
* `routes/` import from `core/` and `schema.ts`. They never import from other `routes/` or `index.ts`.
* `router.ts` imports from `routes/` and `core/`.
* `schema.ts` imports only from `drizzle-orm` and `drizzle-orm/sqlite-core`.
* **No external routing frameworks**: Routing uses native Web Standards (`URLPattern`, regex, or exact path matching) without third-party dependencies.

---

## Testing Architecture

1. **Observable HTTP Contract Testing**: Worker tests execute black-box requests against `worker.fetch(request, env)` using Vitest and in-memory SQLite (`node:sqlite`).
2. **1:1 Endpoint Family Coverage**: Every endpoint family possesses a dedicated test suite under `worker/src/__tests__/`:
   * `health.test.ts` — verifies `/health` returns 200 on healthy D1 and 503 on database failure.
   * `documents.test.ts` — verifies GET public caching and PUT protected ingest with `SEED_TOKEN`.
   * `figures.test.ts` — verifies GET figure bytes, binary Content-Type, path traversal prevention, and PUT upload.
   * `catalog.test.ts` — verifies GET snapshot assembly, GET authoritative material resolution, and PUT bulk relational ingest.
   * `quiz.test.ts` — verifies GET assembled quiz payload, junction re-assembly, and PUT cascading quiz updates.
   * `syncProtocol.test.ts` — verifies sync push idempotency, Model C CAS versioning, Model A LWW, and delta pull queries.
   * `sharesEndpoint.test.ts` — verifies package validation, access types (public/unlisted/passcode), pagination, view/download counters, and deletion.

---

## Consequences

### Positive
- **Maintainability & Modularity**: Each endpoint family resides in a cohesive module under 200 lines, eliminating the 702-line monolith.
- **Predictable Discovery**: Standardized `core/` and `routes/` mirrors the clean layered structure established across the domain and infrastructure layers.
- **Security & Reliability**: Centralized timing-safe auth, traversal-safe path decoding, and global sanitized error boundary eliminate repetitive, error-prone boilerplate.
- **High Performance**: Zero runtime dependencies added; maintains sub-millisecond edge routing and native D1 query execution.
- **Test Discoverability**: 100% test coverage across all public and ingest endpoints.

### Negative / Trade-offs
- Refactoring `worker/src/index.ts` requires touching all endpoint registrations in a coordinated migration.
- Route dispatch table requires disciplined maintenance when adding new endpoints.

---

## Implementation Guidance (Phased Roadmap)

* **Milestone 1**: Author and adopt ADR-016 (Architectural Contract).
* **Milestone 2**: Extract `worker/src/core/` primitives (`cors.ts`, `responses.ts`, `security.ts`, `path.ts`, `types.ts`) with dedicated unit tests.
* **Milestone 3**: Extract route modules into `worker/src/routes/` (`health.ts`, `documents.ts`, `figures.ts`, `catalog.ts`, `quiz.ts`, `sync.ts`, `shares.ts`).
* **Milestone 4**: Implement `worker/src/router.ts` and streamline `worker/src/index.ts` to the slim composition root.
* **Milestone 5**: Author test suites for previously untested endpoints (`health`, `documents`, `figures`, `catalog`, `quiz`) and verify existing `syncProtocol` and `sharesEndpoint` suites pass unchanged.
* **Milestone 6**: Update `worker/AGENTS.md` and root `AGENTS.md` with the new architecture and verification contracts.

---

## Related ADRs
- [ADR-010](ADR-010-replace-barrel-based-feature-boundaries.md) — Replace Barrel-Based Feature Boundaries
- [ADR-012](ADR-012-primary-unit-test-organization-and-discoverability.md) — Primary Unit Test Organization and 1:1 Discoverability Standard
- [ADR-013](ADR-013-uniform-domain-module-organization.md) — Uniform Domain Module Organization
- [ADR-015](ADR-015-uniform-infrastructure-module-organization.md) — Uniform Infrastructure Module Organization
