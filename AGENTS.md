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
**Phase:** 12 complete (Responsive Shell Experience & Architectural Hardening)

## Stack

React 19 + TypeScript + Vite + Dexie.js (IndexedDB) + TanStack Query/Virtual.

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
| Seed share packages (Explore, dry-run) | `npm run seed:shares:local` / `npm run seed:shares:remote` |

**Build process**: `tsc -b` (type-check) then `vite build`. No separate typecheck command — `npm run build` covers it.

**Testing framework**: Vitest (`vitest`) configured in `vitest.config.ts` for unit, fidelity, Dexie persistence, and UI state tests; Playwright (`@playwright/test`) configured in `playwright.config.ts` for real Chromium E2E acceptance tests (`npm run test:e2e`). Blob byte assertions must run under Vitest's `node` environment — `jsdom` + `fake-indexeddb` drops stored bytes, making such comparisons vacuous; see `src/infrastructure/AGENTS.md` (Verification).

**E2E suite status (verified Sep 2026):** the full suite is 19 failed / 4 passed, and the failures are **not** feature regressions. Most die before their own assertions because they seed the library from the **retired catalog** — `tests/e2e/helpers/e2e-setup.ts` → `setupImportedMaterial` (and hard `beforeEach` assertions of catalog titles) in `package/*`, `writer/*`, `reader/reader-annotations`, `quiz/quiz-runner`, `flashcards/flashcard-study`, `generator/ai-generator` — while `onboarding/onboarding` fails on default-term visibility. Green: `explore/explore-hub`, `importer/importer`. Run a target spec and trust that result; re-seed the stale specs from a cloned share before treating any of them as a gate. The helper now mocks **only** the live API surface (`GET /api/shares`); its `/api/catalog`, `/api/documents`, and `/api/quiz` stubs were removed with the retired endpoints, so a stale spec now fails on the missing share content rather than on a fixture that no longer matches any backend.

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

- LunaClair is an installable, offline-capable PWA. `vite-plugin-pwa` emits a service worker precaching the lightweight app shell (~2.8 MB across 51 entries, measured at build), plus a web manifest (`display: standalone`, white theme). SW registration and the manifest link are auto-injected at build — no manual `registerSW` call.
- **Study-package distribution:** `.lcpack` StudyPackage sharing via `/api/shares` and `SharedPackageScreen` is the **exclusive** content distribution mechanism — the legacy catalog and raw document/figure endpoints were retired; canonical course definitions (`content/materials`, `content/catalog`, `content/quiz`) serve as inputs for the publisher seeder (`scripts/seed-shares.mjs`). A fresh install starts with an empty library (never on boot). Users build their library from the **Explore Hub** (`/explore`): **Clone to Library** (`ClonePublishedShareUseCase`) atomically persists a share's metadata, document markdown (in the `documentContents` Dexie store), and its questions/quizzes into Dexie; `RemoveImportedMaterialUseCase` removes it locally (the material's Dexie rows including its stored assets, atomically). Non-imported materials are viewed on the share landing surface (`/share/:shareId`) — never the workspace (`/materials/:id`), which stays synonymous with "this is one of my materials". The share surface never touches the local library and never fires "last opened" — no partial-open state leaks into the workspace's local-first invariants. The reader serves imported content directly from Dexie (`HybridDocumentRepository`), including `lc-asset://` figures, which resolve to local object URLs from the asset store (`localAssets`) via the reader's asset map — never a network fetch. **D1 = share/cloud-sync backing store; Dexie = user's local selection/working state; Service Worker Cache Storage = network-resource cache, never the source of truth for library membership.**
- TanStack Query runs with `networkMode: 'offlineFirst'` for **queries and mutations** (see `AppProviders`) so IndexedDB-backed operations execute — not pause — when `navigator.onLine` is false. Do not revert to the default `'online'` mode (it freezes fresh lookups and defers Dexie writes while offline).
- Offline synchronization (sync queue, single SQL CAS, conflict resolution) and Cloud Sharing (`.lcpack` / D1 share links) are shipped.
- Icon pipeline: `npm run generate:pwa-assets` regenerates `pwa-*`/maskable/apple-touch PNGs in `public/` from `public/app-icon.svg` (a square derivation of `favicon.svg`).
- Install discovery (community-reviewed, Aug 2026): quiet opt-in `Install app` / `Add to Home Screen` sidebar entry + a one-time iOS-only card from the second visit (dismissed forever, hidden when installed and in dev). Deliberately no `beforeinstallprompt`/deferred-prompt machinery — Chromium already surfaces install natively, iOS has none. Details in `src/app/AGENTS.md`.
- First-run onboarding (Aug 2026): one-time, skippable welcome tutorial mounted by `AppShell` — bundled app chrome with zero network dependency. Details in `src/app/AGENTS.md`.

## Cloudflare / D1

- LunaClair runs a Cloudflare backend: a D1 database (`lunaclair`, serverless SQLite) as the **cloud sync, sharing, and content distribution layer** for the local-first Dexie store.
- D1 is never called directly from the browser — all cloud data flows through the **`api` Cloudflare Worker** (`worker/`, config in root `wrangler.jsonc`): browser → Worker REST API → D1 binding (`DB`).
- Architecture (ADR-016): zero-framework, layered architecture using native Web Standards (`Request`/`Response`, declarative segment router, isolated route handlers in `worker/src/routes/`, core primitives in `worker/src/core/`, slim composition root in `worker/src/index.ts`).
- Schema is authored with Drizzle ORM (`worker/src/schema.ts` → `npm run db:generate` → versioned migrations in `worker/migrations/`); `GET /health` on the Worker verifies D1 connectivity.
- Remote SQL: `npx wrangler d1 execute lunaclair --remote --command "<sql>"`.
- Offline synchronization (Dexie ⇄ D1 sync queue, single-flight sync engine, conflict resolution) and Cloud Sharing (`/api/shares`) are active in production.
- Share seeder (`scripts/seed-shares.mjs`): transforms canonical content (`content/catalog/materials.json` + `content/materials/*/index.md` + figures + `content/quiz/*.json`) into `.lcpack` StudyPackage payloads and publishes them as `public` shares via `POST /api/shares`. Every package must pass the `MAX_SHARE_PAYLOAD_BYTES` (5 MiB) size guard after base64 encoding and satisfy both the Worker validator (`validateServerStudyPackage`) and the stricter client validator (strict `pkg_*_[a-zA-Z0-9_-]` IDs, `metadata.createdAt`) so Explore cloning round-trips. The `seed:shares:*` npm scripts are dry-run validators only; publishing requires `node scripts/seed-shares.mjs --local|--remote` (idempotent by title, `--force` to delete + republish). Oversized packages fail loudly by design. **Material tags** are seeded from each catalog entry's `tags` array and travel with the package (the app validates, remaps, and imports them onto the cloned material); the seeder deliberately does **not** derive them from question tags — one course's published questions carry 60+ distinct topics, which is a question index rather than a material's tag set — and it warns per material that has none, so untagged canonical content is visible instead of silent. Adding tags is therefore a content edit in `content/catalog/materials.json`, not a code change. Figure budget: `content/materials/**/images` must keep every material's serialized package under the 5 MiB ceiling; re-optimize in place via `node scripts/optimize-figures.mjs` (sharp PNG, filenames preserved) when figures grow.
- See `worker/AGENTS.md` for Worker-specific contracts.

## Conventions

- No CI, no tests, no formatting config (beyond oxlint).
- Commit messages: use `commit-message` skill (`.agents/skills/commit-message/SKILL.md`) — generates conventional commits from staged changes.
- React code quality: use `react-doctor` skill (`.agents/skills/react-doctor/SKILL.md`) — scans for React anti-patterns, performance, security, architecture, accessibility. Run after any React code changes.
- React Doctor false positives: proven detector false positives are recorded in `.react-doctor/false-positives.md` with the rule's own suppression predicate, the observed evidence, and a review condition. The CLI does not read this file — it is a reviewable record, so rejected diagnostics are expected to keep appearing in scans. Do not disable a correctness rule globally to clear one occurrence.
- React Doctor scan scope: verify suppression work with a **full** scan (`--scope full`). `--scope changed` reports 100/100 even for a file that carries an active diagnostic (observed for both a newly added and a later modified file), so a changed-scope pass proves nothing about these rules.
- `doctor.config.ts` holds react-doctor rule overrides (Sep 2026): `react-doctor/async-await-in-loop` and `react-doctor/no-adjust-state-on-prop-change` are disabled by design — sequential processing is mandated by sync/importer contracts (Dexie transaction integrity, PDF OOM avoidance, SQLite CAS ordering), and the render-phase prop-adjustment pattern (e.g. `MaterialWriterTab` dirty material-switch interception) is the React-recommended approach. `react-doctor/no-derived-state` + `no-derived-state-effect` are likewise disabled: the writer draft is user-editable state that must be initialized/refreshed from the server document via guarded effects — it cannot be derived during render because edits must survive re-fetches. Keep intentional warnings out of the score via config, not by degrading code. A single-site exception uses the narrower `ignore.overrides` (file + rule) instead of a rule off-switch, so the rule stays active repo-wide; the rationale and the rule's own suppression predicate are recorded in `.react-doctor/false-positives.md`.
- StyleX file-naming convention: when StyleX rules are extracted from component files, they must strictly follow the `*.stylex.ts` naming format (e.g. `library.stylex.ts`, `toolbar.stylex.ts`) rather than suffix notation (`*Styles.ts`), ensuring compatibility with Vite/StyleX compiler transforms and clear codebase visual indexing.
- Design-token vocabulary (Sep 2026): application code colours are referenced by role as `var(--color-*)`; literal colour values live only in `src/shared/theme/lunaclairTheme.ts`. Sentiment roles are exactly `--color-{success,error,warning}` plus their `-muted` / `-on-*` siblings — **`--color-danger` does not exist in Astryx and must not be added as an alias** (Astryx uses Button `variant:destructive` for action severity and `error` for every state-carrying component). Never rely on a fallback for a role token: an undefined token is invalid at computed-value time and drops to the inherited value rather than degrading. Details and evidence in `docs/architecture/ui-guidelines.md` (Semantic Role Vocabulary).
- Screen layer structure (Sep 2026): every folder under `src/app/screens/` exposes exactly one route screen (`*Screen.tsx`) at its root; supporting files live in feature-style subfolders — `components/`, `modals/`, `hooks/`, `utils/`, `styles/` (`*.stylex.ts`) — with tests colocated in the matching `__tests__/` (ADR-012). Applied across `collection-workspace/`, `library/`, and `home/`. See `src/app/screens/AGENTS.md` (Folder taxonomy).
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
| `src/features/collections/AGENTS.md` | `src/features/collections/` | Collections & Playlists — user-curated material collections, custom ordering, and collection modals |
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
| `worker/AGENTS.md` | `worker/` | Cloudflare Worker API — ADR-016 layered architecture, D1 bridge, schema migrations, deploy workflow |

