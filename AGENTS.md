# DOX framework

- DOX is a self-documenting AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:
- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

---

## Project LunaClair

**Studio:** Saiko Interactive
**Type:** AI-powered learning platform
**Phase:** 11 complete (Collaboration & Sharing)

## Stack

React 19 + TypeScript + Vite + Dexie.js (IndexedDB).

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Clean trailing whitespace | `npm run clean:whitespace` |
| Test (Unit & Integration) | `npm run test:run` / `npm run test` / `npm run test:coverage` |
| Test (E2E Acceptance) | `npm run test:e2e` |
| Regenerate PWA icons | `npm run generate:pwa-assets` |
| Dev API Worker | `npm run dev:api` |
| Deploy API Worker | `npm run deploy:api` |
| Regenerate Worker types | `npm run types:worker` |
| Generate D1 migration (Drizzle) | `npm run db:generate` |
| Apply D1 migrations | `npm run db:apply:local` / `npm run db:apply:remote` |

**Build process**: `tsc -b` (type-check) then `vite build`. No separate typecheck command — `npm run build` covers it.

**Testing framework**: Vitest (`vitest`) configured in `vitest.config.ts` for unit, fidelity, Dexie persistence, and UI state tests; Playwright (`@playwright/test`) configured in `playwright.config.ts` for real Chromium E2E acceptance tests (`npm run test:e2e`).

## Linter

Uses **oxlint** (not ESLint). Config at `.oxlintrc.json`.
Plugins: `react`, `typescript`, `oxc`.
Rules: `react/rules-of-hooks` (error), `react/only-export-components` (warn).

## Architecture

Feature-based architecture:

```
src/
  app/            — Application shell, config, providers
  application/    — Framework-agnostic application use cases
  domain/         — Business domain models (pure data, no UI)
  features/       — Feature modules (catalog, reader, quiz, quiz-management, …)
  infrastructure/ — Persistence and external API layer (Dexie database, API adapters, repositories)
  shared/         — Shared types, constants, utilities, base components
  styles/         — Global styles and master stylesheet
```

See `docs/architecture/architecture.md` and `docs/architecture/adr/` for full details.

## TypeScript

Three tsconfig files:
- `tsconfig.app.json` — covers `src/` (app code)
- `tsconfig.node.json` — covers `vite.config.ts` (tooling)
- `tsconfig.worker.json` — covers `worker/` (Cloudflare Worker)

Strict flags: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`.

## Import Rules

1. **Direct-path feature contracts (ADR-010)** — feature-root barrels were removed; features consume another feature only through the approved direct module paths listed in `src/features/AGENTS.md` (Local Contracts → no-barrel-import).
2. **Internal feature privacy** — imports into `features/<name>/components`, `hooks`, `queries`, `types`, or other internal paths are prohibited from outside that feature. User-directed exception (Aug 2026): `react-doctor/no-barrel-import` is resolved project-wide, and the specific cross-feature direct-path imports that replaced feature barrels are listed in `src/features/AGENTS.md` (Local Contracts → no-barrel-import). New cross-feature consumption follows the documented direct-path pattern and must extend that allow-list.
3. **Domain modules** import only from other domains or pure libraries — never from React, features, or infrastructure.
4. **Shared code** is strictly domain-agnostic; business capability code belongs to its owning feature.
5. **Infrastructure** imports from `domain/` (contracts) and `shared/` (types/utilities) but not from features. Scoped exception: application draft contracts in `DexieQuizDraftRepository`.
6. **Feature-Root Barrels Prohibited (ADR-010)** — Features do not expose root `index.ts` boundary barrels; cross-feature consumption uses approved direct module paths listed in `src/features/AGENTS.md`. Domain and application layers may expose stable module barrels where actively consumed by composition roots or features.
7. **Architectural Boundary Guardrails (Oxlint)** — `src/features/**` is statically prohibited from importing `src/infrastructure/**` or reintroduced legacy service modules via Oxlint `no-restricted-imports`. All write mutations must route through `src/application/` use cases; repository access in features is restricted to read/query paths via dependency injection.

## PWA / Offline

- LunaClair is an installable, offline-capable PWA. `vite-plugin-pwa` emits a service worker precaching the lightweight app shell (~1.5 MB), plus a web manifest (`display: standalone`, white theme). SW registration and the manifest link are auto-injected at build — no manual `registerSW` call.
- Study materials (documents & figures) live in Cloudflare D1, served on-demand by the `api` Worker (`https://api.project-lunaclair.workers.dev`) and cached by the service worker via Workbox `CacheFirst` runtime caching (materials work offline after their first open).
- Canonical study materials live at `content/materials/` (Git-versioned, never shipped to `dist/`). Ingest into D1 is performed via `npm run seed:materials:local` / `npm run seed:materials:remote` (`scripts/seed-materials.mjs`).
- The library catalog (subjects, terms, subject-term links, materials metadata) is D1-delivered: canonical data lives at `content/catalog/*.json`, ingested via `npm run seed:catalog:local` / `npm run seed:catalog:remote` (`scripts/seed-catalog.mjs`), and served as one public snapshot at `GET /api/catalog`. Quiz content (questions/quizzes) follows the same pattern: `content/quiz/*.json` → `npm run seed:quiz:local` / `seed:quiz:remote` → `GET /api/quiz`.
- **Catalog-first, user-selected library model (no auto-hydration).** The app does **not** copy the D1 catalog into Dexie on boot — a fresh install starts with an empty library (the three default academic terms — Prelim/Midterm/Finals — are the exception: they sync into Dexie when first-run onboarding is completed, or arrive with material import; never on boot). The catalog is fetched independently (TanStack Query → `GET /api/catalog`, SW runtime-cached) and surfaced via the **Explore Hub** (`/explore`); users explicitly **Add to Library** / **Remove from Library** per material via `ImportMaterialUseCase` / `RemoveImportedMaterialUseCase`. **Read-only preview** (Aug 2026, community-reviewed): non-imported materials open a dedicated preview surface (`/available/:materialId/preview`, `PreviewMaterialScreen`) that resolves the material authoritatively per-id, renders the document read-only (Dexie-first, API fallback — same `HybridDocumentRepository`), and offers Add to Library — a deliberate distinct surface so the full workspace (`/materials/:id`) stays synonymous with "this is one of my materials". Preview never touches the local library, never writes study state, and never fires "last opened" — no partial-open state leaks into the workspace's local-first invariants. Import resolves the material authoritatively per-id (`GET /api/catalog/materials/:id`, uncached) — **import must never require the full catalog snapshot in memory**; `GET /api/catalog` stays a discovery read model. Importing a material atomically persists its subject/term links, metadata, document markdown (in the `documentContents` Dexie store), and its questions/quizzes from `GET /api/quiz`; figures stay SW-cached. The reader serves imported content from Dexie first (`HybridDocumentRepository`), API second. **D1 = canonical catalog; Dexie = user's local selection/working state; Service Worker Cache Storage = network-resource cache, never the source of truth for library membership.**
- TanStack Query runs with `networkMode: 'offlineFirst'` for **queries and mutations** (see `AppProviders`) so IndexedDB-backed operations execute — not pause — when `navigator.onLine` is false. Do not revert to the default `'online'` mode (it freezes fresh lookups and defers Dexie writes while offline).
- Offline synchronization (sync queue, single SQL CAS, conflict resolution) and Cloud Sharing (`.lcpack` / D1 share links) are shipped.
- Icon pipeline: `npm run generate:pwa-assets` regenerates `pwa-*`/maskable/apple-touch PNGs in `public/` from `public/app-icon.svg` (a square derivation of `favicon.svg`).
- Install discovery (community-reviewed, Aug 2026): quiet opt-in `Install app` / `Add to Home Screen` sidebar entry + a one-time iOS-only card from the second visit (dismissed forever, hidden when installed and in dev). Deliberately no `beforeinstallprompt`/deferred-prompt machinery — Chromium already surfaces install natively, iOS has none. Details in `src/app/AGENTS.md`.
- First-run onboarding (Aug 2026): one-time, skippable welcome tutorial mounted by `AppShell` — bundled app chrome with zero network dependency; its Finish AND Skip actions call `SyncDefaultTermsUseCase` to sync the default academic terms into Dexie from the (SW-cached) catalog (dismissal is never punished). Details in `src/app/AGENTS.md`.

## Cloudflare / D1

- LunaClair runs a Cloudflare backend: a D1 database (`lunaclair`, serverless SQLite) as the **cloud sync, sharing, and content distribution layer** for the local-first Dexie store.
- D1 is never called directly from the browser — all cloud data flows through the **`api` Cloudflare Worker** (`worker/`, config in root `wrangler.jsonc`): browser → Worker REST API → D1 binding (`DB`).
- Schema is authored with Drizzle ORM (`worker/src/schema.ts` → `npm run db:generate` → versioned migrations in `worker/migrations/`); `GET /health` on the Worker verifies D1 connectivity.
- Remote SQL: `npx wrangler d1 execute lunaclair --remote --command "<sql>"`.
- Offline synchronization (Dexie ⇄ D1 sync queue, single-flight sync engine, conflict resolution) and Cloud Sharing (`/api/shares`) are active in production.
- See `worker/AGENTS.md` for Worker-specific contracts.

## Conventions

- No CI, no tests, no formatting config (beyond oxlint).
- Commit messages: use `commit-message` skill (`.agents/skills/commit-message/SKILL.md`) — generates conventional commits from staged changes.
- React code quality: use `react-doctor` skill (`.agents/skills/react-doctor/SKILL.md`) — scans for React anti-patterns, performance, security, architecture, accessibility. Run after any React code changes.
- StyleX file-naming convention: when StyleX rules are extracted from component files, they must strictly follow the `*.stylex.ts` naming format (e.g. `library.stylex.ts`, `toolbar.stylex.ts`) rather than suffix notation (`*Styles.ts`), ensuring compatibility with Vite/StyleX compiler transforms and clear codebase visual indexing.
- Architecture chronicle: use `architecture-chronicle` skill (`.agents/skills/architecture-chronicle/SKILL.md`) — generates long-term engineering chronicles capturing architecture, data flows, migrations, and system evolution after a phase.
- Community questions: use `community-question` skill (`.agents/skills/community-question/SKILL.md`) — drafts self-contained, paste-ready forum questions grounded in the actual codebase when the user wants outside opinions on a design or architecture decision.
- No `prettier`, `eslint`, or `biome`. Do not add them without asking.

## User Preferences

- Agent should keep documentation lean and operational — prefer concise bullets over prose.
- When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/application/AGENTS.md` | `src/application/` | Application use cases and workflow contracts |
| `src/app/AGENTS.md` | `src/app/` | Application shell, layout, config, providers |
| `src/domain/AGENTS.md` | `src/domain/` | Business domain models and logic |
| `src/features/AGENTS.md` | `src/features/` | Feature module policies and orchestration |
| `src/features/materials/AGENTS.md` | `src/features/materials/` | Study Materials — local library management, material cards, material CRUD dialogs |
| `src/features/subjects/AGENTS.md` | `src/features/subjects/` | Academic Subjects — subject entities, cards, hierarchy, and subject modals |
| `src/features/terms/AGENTS.md` | `src/features/terms/` | Academic Terms — terms management, subject-term junctions, and usage counts |
| `src/features/discovery/AGENTS.md` | `src/features/discovery/` | Content Discovery — remote catalog exploration, public share cloning, and read-only previews |
| `src/features/quiz/AGENTS.md` | `src/features/quiz/` | Quiz Assessment Engine — live session runner, question renderer, session state machine |
| `src/features/flashcards/AGENTS.md` | `src/features/flashcards/` | Spaced-Repetition Study — SM-2 scheduling, card projection, 3D flip card player |
| `src/features/analytics/AGENTS.md` | `src/features/analytics/` | Analytics & Learning Insights feature — Study overview, retention, mastery, activity heatmap |
| `src/features/ai/AGENTS.md` | `src/features/ai/` | AI Study Assistant & Content Generation — Chat drawer, grounded context, generator dialogs |
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
| `src/features/importer/AGENTS.md` | `src/features/importer/` | Content Importer feature — 5-step wizard, PDF & OCR extraction, Lexical review |
| `src/features/quiz-management/AGENTS.md` | `src/features/quiz-management/` | Quiz & question authoring — Question Bank, Quiz Catalog, editors, publishing |
| `src/features/writer/AGENTS.md` | `src/features/writer/` | Writer feature — standard Lexical WYSIWYG authoring, lossless Markdown transformation |
| `src/features/sync/AGENTS.md` | `src/features/sync/` | Cloud Synchronization UX — Status pill, conflict resolution modal, reactive synchronization hooks |
| `src/features/package/AGENTS.md` | `src/features/package/` | Study Package feature — .lcpack export & import hooks, package inspection & preview modal |
| `src/infrastructure/AGENTS.md` | `src/infrastructure/` | Persistence layer — Dexie database, repositories, migration, import services |
| `src/shared/AGENTS.md` | `src/shared/` | Shared types, constants, utilities, hooks, components |
| `worker/AGENTS.md` | `worker/` | Cloudflare Worker API — D1 bridge, schema migrations, deploy workflow |

