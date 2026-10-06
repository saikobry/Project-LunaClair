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

### Single-Source Rules

Every rule has exactly one owning statement. These five rules enforce that, and a doc that breaks them is over-budget even when it is accurate. `src/__tests__/architecture/doxConsistency.test.ts` mechanically enforces the checkable ones — phantom paths, symbols cited live after removal, verbatim duplicate bullets, list-nesting jumps, and oversized-line growth — so a defect in this corpus fails the suite instead of waiting for a reader.

- **State a rule once, in the doc that owns it.** Every other mention is a pointer: name the owner and restate only what is local to that scope (`see \`<path>\``). A rule written out twice is two rules that will drift — the second copy is what makes a doc feel bloated without making it safer. The owner is the nearest doc whose subject the rule decides; for a value (a colour, radius, easing, constant, schema field) the owner is the **source artifact** that holds it, not prose.
- **One rule per bullet, and a bullet reads in one screen.** A bullet or table cell must not carry a multi-hundred-word paragraph. Split it into named sub-rules — `**Name.** contract` — one contract each. When a table cell needs an essay, the table is the wrong shape: leave ownership in the table and move the detail to `Local Contracts` as named sub-rules.
- **Never restate a literal another artifact owns.** Pixel values, colours, easings, and constants live in the stylesheet, schema, or test that owns them; the doc names the artifact and the behaviour, never the number. A literal copied into prose is a second source of truth that no test can keep honest.
- **A rewrite is verified by coverage, not by reading.** Before deleting a contract, extract the identifiers it names (constants, functions, file paths, error codes) from the source it documents and confirm every one still appears in the rewritten doc; then re-run the doc's own Verification. A doc that reads well and lost a constant is worse than a verbose one.
- **Docs must describe files that exist.** An Ownership entry naming a module that is not on disk, or a route screen owned by a feature instead of `src/app/screens/`, is a defect — re-check the path when moving or renaming anything.

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
**Phase:** 12 complete (Responsive Shell Experience & Architectural Hardening — through 12M, 2026-10-06; `v0.3.0` released to production; see `docs/roadmap.md`)

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
| Apply D1 migrations | `npm run db:apply:local` / `npm run db:apply:production` |
| Apply D1 migrations (staging) | `npm run db:apply:staging` |
| Seed share packages (Explore, dry-run) | `npm run seed:shares:local` / `npm run seed:shares:production` / `npm run seed:shares:staging` |
| Regenerate E2E share fixtures | `npm run generate:e2e-fixtures` |

**Build process**: `tsc -b` (type-check) then `vite build`. No separate typecheck command — `npm run build` covers it.

**Testing framework**: Vitest (`vitest`) configured in `vitest.config.ts` for unit, fidelity, Dexie persistence, and UI state tests; Playwright (`@playwright/test`) configured in `playwright.config.ts` for real Chromium E2E acceptance tests (`npm run test:e2e`). Blob byte assertions must run under Vitest's `node` environment — `jsdom` + `fake-indexeddb` drops stored bytes, making such comparisons vacuous; see `src/infrastructure/AGENTS.md` (Verification).

**E2E suite status (verified Sep 2026):** the full Playwright suite is green: **41/41 passed** from a clean browser/IndexedDB state. All specs seed through live `/api/shares` clone flows; `package/*`, `generator/ai-generator`, `analytics/insights`, onboarding, writer, reader, quiz, and flashcard coverage are current. The helper mocks **only** the live API surface (`GET /api/shares`); retired `/api/catalog`, `/api/documents`, and `/api/quiz` endpoints are never mocked.

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

Four tsconfig files:
- `tsconfig.app.json` — covers `src/` (app code). `src/__tests__/architecture` and `src/__tests__/e2eFixtures` are **excluded**: they are Node-API test harnesses (`node:fs`/`node:path`) and this config carries only `vite/client` types, so they would not typecheck. They are still run by Vitest. `src/__tests__/e2eFixtures` also holds unit tests for `tests/e2e/helpers` modules, so it reaches outside `src/` entirely; that folder is therefore in **no** tsconfig project (`tsconfig.app.json` excludes it, `tsconfig.e2e.json` starts at `tests/e2e`) and `tsc -b` does not typecheck it. A green build is not evidence those tests typecheck.
- `tsconfig.node.json` — covers `vite.config.ts` (tooling)
- `tsconfig.worker.json` — covers `worker/` (Cloudflare Worker)
- `tsconfig.e2e.json` — composite Playwright support project; covers `tests/e2e/**/*.ts` plus the imported app/domain modules and pure `scripts/lib` modules, with Node + DOM libs and explicit Playwright imports.

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
- **Study-package distribution:** `.lcpack` StudyPackage sharing via `/api/shares` and `SharedPackageScreen` is the **exclusive** content distribution mechanism — the legacy catalog and raw document/figure endpoints were retired; canonical course definitions (`content/materials`, `content/catalog`, `content/quiz`) serve as inputs for the publisher seeder (`scripts/seed-shares.mjs`). A fresh install starts with an empty library (never on boot). Users build their library from the **Explore Hub** (`/explore`): **Clone to Library** (`ClonePublishedShareUseCase`) atomically persists a share's metadata, document markdown (in the `documentContents` Dexie store), and its questions/quizzes into Dexie; `RemoveMaterialUseCase` removes it locally (the material's Dexie rows including its stored assets, atomically). Non-imported materials are viewed on the share landing surface (`/share/:shareId`) — never the workspace (`/materials/:id`), which stays synonymous with "this is one of my materials". The share surface never touches the local library and never fires "last opened" — no partial-open state leaks into the workspace's local-first invariants. The reader serves imported content directly from Dexie (`HybridDocumentRepository`), including `lc-asset://` figures, which resolve to local object URLs from the asset store (`localAssets`) via the reader's asset map — never a network fetch. **D1 = share/cloud-sync backing store; Dexie = user's local selection/working state; Service Worker Cache Storage = network-resource cache, never the source of truth for library membership.**
- TanStack Query runs with `networkMode: 'offlineFirst'` for **queries and mutations** (see `AppProviders`) so IndexedDB-backed operations execute — not pause — when `navigator.onLine` is false. Do not revert to the default `'online'` mode (it freezes fresh lookups and defers Dexie writes while offline).
- Offline synchronization (sync queue, single SQL CAS, conflict resolution) and Cloud Sharing (`.lcpack` / D1 share links) are shipped.
- Icon pipeline: `npm run generate:pwa-assets` regenerates `pwa-*`/maskable/apple-touch PNGs in `public/` from `public/app-icon.svg` (a square derivation of `favicon.svg`).
- Install discovery (community-reviewed, Aug 2026): quiet opt-in `Install app` / `Add to Home Screen` sidebar entry + a one-time iOS-only card from the second visit (dismissed forever, hidden when installed and in dev). Deliberately no `beforeinstallprompt`/deferred-prompt machinery — Chromium already surfaces install natively, iOS has none. Details in `src/app/AGENTS.md`.
- First-run onboarding (Aug 2026): one-time, skippable welcome tutorial mounted by `AppShell` — bundled app chrome with zero network dependency. Details in `src/app/AGENTS.md`.

## Cloudflare / D1

- LunaClair runs a Cloudflare backend: a D1 database (`lunaclair`, serverless SQLite) as the **cloud sync, sharing, and content distribution layer** for the local-first Dexie store.
- D1 is never called directly from the browser — all cloud data flows through the **`api` Cloudflare Worker** (`worker/`, config in root `wrangler.jsonc`): browser → Worker REST API → D1 binding (`DB`).
- Architecture (ADR-016): zero-framework, layered architecture using native Web Standards (`Request`/`Response`, declarative segment router, isolated route handlers in `worker/src/routes/`, core primitives in `worker/src/core/`, slim composition root in `worker/src/index.ts`).
- **AI model contract (invariants; full contract in `worker/AGENTS.md` and `src/features/ai/AGENTS.md`):** the Worker owns the AI model registry and serves its public projection at `GET /api/ai/models`; a request's optional `model` resolves against it, applying that model's own output reservation and document cap. Four rules hold repo-wide: **(1) no silent fallback model** — every failure is explicit and coded (`AI_DISABLED`, `MODEL_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `CONTEXT_LIMIT`, `RATE_LIMITED` with `retryAfterSeconds`, `TIMEOUT`, `ABORTED`, `UPSTREAM_ERROR`, …) rather than a substitution the user did not ask for; **(2) availability is server-controlled without a deploy** — `AI_DISABLED_MODELS` retires individual models and `AI_CHAT_DISABLED` stops the assistant entirely, with **nothing exempt**, so the client shows the assistant as switched off instead of picking another model; **(3) a deadline or disconnect cancels the outbound work**, it does not merely abandon the promise — a client cancellation reports `ABORTED` rather than a misleading 502; **(4) window, output reservation, document cap, and rates are per-model facts**, so a new model is a registry row, never a new literal in the client. Vendors live behind an internal `AiProvider` boundary (`worker/src/ai/`), so adding one is a file plus a registry row and the client never learns a provider. **Every AI request writes exactly one structured telemetry record** and it **never carries prompt, document, or selection content** — that is what makes MAX's real rate-limit frequency measurable rather than assumed.
- Schema is authored with Drizzle ORM (`worker/src/schema.ts` → `npm run db:generate` → versioned migrations in `worker/migrations/`); `GET /health` on the Worker verifies D1 connectivity.
- Remote SQL: `npx wrangler d1 execute lunaclair --remote --command "<sql>"`.
- Offline synchronization (Dexie ⇄ D1 sync queue, single-flight sync engine, conflict resolution) and Cloud Sharing (`/api/shares`) are shipped and **live in production as of `v0.3.0` (2026-10-06)**: the production D1 (`lunaclair`) is fully migrated (`wrangler d1 migrations list lunaclair --remote` reports no pending migrations), so `user_documents`, `user_entities`, `sync_changes`, `sync_idempotency`, and `shares` all exist and the legacy catalog tables are **dropped** (~163 dev-seed rows lost). The production Worker and the production frontend are a **matched pair** and must be released **together**: the Worker serves `/api/shares` + `/api/sync/*` and the retired catalog endpoints now 404, so deploying either one alone breaks the live site. Ask before any further `deploy:api` or production migration — both are one-way.
- **Share seeder (rules; full contract in `scripts/AGENTS.md`):** `.lcpack` StudyPackage is the only content distribution format, and the seeder transforms canonical content (`content/**`) into payloads published as `public` shares via `POST /api/shares`. Two rules bind any change here: **(1) there is exactly ONE validation tier and the client and the Worker agree exactly** — a structurally malformed question payload is refused on **import as well as publish**, and every package must pass the `MAX_SHARE_PAYLOAD_BYTES` (5 MiB) guard after base64 encoding, so Explore cloning round-trips; **(2) the seeder must not restate those rules** — it imports the domain's `validateQuestionPayload`, so it cannot report a `PASS` the endpoint would refuse. **Every `seed:shares:*` npm script is a dry-run validator — none of them publish**; publishing requires calling the CLI directly, and a dry run prints that exact command for its resolved target. **Material tags** travel with the package from each catalog entry's `tags` array (the app validates, remaps, and imports them onto the cloned material) and are deliberately **not** derived from question tags; adding tags is a content edit in `content/catalog/materials.json`, not a code change. Figure budget: `content/materials/**/images` must keep every material's serialized package under the 5 MiB ceiling — re-optimize in place via `node scripts/optimize-figures.mjs` when figures grow.
- See `worker/AGENTS.md` for Worker-specific contracts.

## Conventions

- No CI.
- Commit messages: use `commit-message` skill (`.agents/skills/commit-message/SKILL.md`) — generates conventional commits from staged changes.
- React code quality: use `react-doctor` skill (`.agents/skills/react-doctor/SKILL.md`) — scans for React anti-patterns, performance, security, architecture, accessibility. Run after any React code changes.
- React Doctor false positives: proven detector false positives are recorded in `.react-doctor/false-positives.md` with the rule's own suppression predicate, the observed evidence, and a review condition. The CLI does not read this file — it is a reviewable record, so rejected diagnostics are expected to keep appearing in scans. Do not disable a correctness rule globally to clear one occurrence.
- React Doctor scan scope: verify suppression work with a **full** scan (`--scope full`). `--scope changed` reports 100/100 even for a file that carries an active diagnostic (observed for both a newly added and a later modified file), so a changed-scope pass proves nothing about these rules.
- `doctor.config.ts` holds react-doctor rule overrides (Sep 2026): `react-doctor/async-await-in-loop` and `react-doctor/no-adjust-state-on-prop-change` are disabled by design — sequential processing is mandated by sync/importer contracts (Dexie transaction integrity, PDF OOM avoidance, SQLite CAS ordering), and the render-phase prop-adjustment pattern (e.g. `MaterialWriterTab` dirty material-switch interception) is the React-recommended approach. `react-doctor/no-derived-state` + `no-derived-state-effect` are likewise disabled: the writer draft is user-editable state that must be initialized/refreshed from the server document via guarded effects — it cannot be derived during render because edits must survive re-fetches. Keep intentional warnings out of the score via config, not by degrading code. A single-site exception uses the narrower `ignore.overrides` (file + rule) instead of a rule off-switch, so the rule stays active repo-wide; the rationale and the rule's own suppression predicate are recorded in `.react-doctor/false-positives.md`.
- StyleX file-naming convention: when StyleX rules are extracted from component files, they must strictly follow the `*.stylex.ts` naming format (e.g. `library.stylex.ts`, `toolbar.stylex.ts`) rather than suffix notation (`*Styles.ts`), ensuring compatibility with Vite/StyleX compiler transforms and clear codebase visual indexing.
- **StyleX media-query keys must be string literals — never computed.** StyleX evaluates style objects statically at build time, so a key like `[nonTablet]:` (referencing a module-level `const nonTablet = '@media …'`) is **silently dropped**: no error, no warning, the rule simply never exists in the emitted CSS. Write the key inline instead — `'@media (max-width: 768px), (min-width: 1024px)': { … }`. This is invisible in dev (StyleX's runtime injects styles on the fly) and only shows up in a production build. Symptom seen Oct 2026: all three viewport nav slices (`DesktopSidebar` / `TabletRail` / `MobileBottomDock`) rendered simultaneously at every width, because each one's hide-itself rule was computed-keyed and therefore absent from the bundle; the rail also lost `position: fixed` and fell into normal flow beside the sidebar. **Verify a media rule actually compiled by grepping the built `dist/` CSS for it — a green build proves nothing here.**
- Design-token vocabulary (Sep 2026): application code colours are referenced by role as `var(--color-*)`; literal colour values live only in `src/shared/theme/lunaclairTheme.ts`. Sentiment roles are exactly `--color-{success,error,warning}` plus their `-muted` / `-on-*` siblings and the LunaClair-added `-border` outline roles — **`--color-danger` does not exist in Astryx and must not be added as an alias** (Astryx uses Button `variant:destructive` for action severity and `error` for every state-carrying component). Never rely on a fallback for a role token: an undefined token is invalid at computed-value time and drops to the inherited value rather than degrading, and a wrong-value fallback (`#17181d` on a light surface token) paints the opposite of what was meant. Code, chat, and badge surfaces resolve through distinct families (`--color-background-code` / `--color-text-code` / `--color-background-code-inline`; `--color-background-chat-assistant` / `--color-text-chat-assistant`; per-hue `--color-badge-*`), and syntax-highlight palettes stay untokenized. Details and evidence in `docs/architecture/ui-guidelines.md` (Semantic Role Vocabulary).
- Removal vocabulary (Sep 2026): material removal reads **Remove from Library**, never "Delete" — the published share survives and can be cloned again, while local content does not; collections stay **deleted** (local-only) and collection membership is **removed from a collection**. A destructive confirmation must name what is deleted and what can be recovered — the reference is `RemoveMaterialModal`. Details in `docs/architecture/ui-guidelines.md` (Removal vs Delete Vocabulary).
- Screen layer structure (Sep 2026): every folder under `src/app/screens/` exposes exactly one route screen (`*Screen.tsx`) at its root; supporting files live in feature-style subfolders — `components/`, `modals/`, `hooks/`, `utils/`, `styles/` (`*.stylex.ts`) — with tests colocated in the matching `__tests__/` (ADR-012). Applied across `collection-workspace/`, `library/`, `home/`, `material-workspace/`, and `importer/`. See `src/app/screens/AGENTS.md` (Folder taxonomy).
- Architecture chronicle: use `architecture-chronicle` skill (`.agents/skills/architecture-chronicle/SKILL.md`) — generates long-term engineering chronicles capturing architecture, data flows, migrations, and system evolution after a phase.
- Community questions: use `community-question` skill (`.agents/skills/community-question/SKILL.md`) — drafts self-contained, paste-ready forum questions grounded in the actual codebase when the user wants outside opinions on a design or architecture decision.
- No `prettier`, `eslint`, or `biome`. Do not add them without asking.

## Evidence Before Compatibility

- **Before introducing a compatibility promise, require an evidence record: which real artifacts need it, how they were checked, and which behavior must remain compatible.** A tolerance tier, a fallback branch, a legacy-shaped branch, or a duplicated defensive guard all qualify. The record answers three questions and a promise without one is not a promise — it is a guess:
  1. **Which real artifacts need this?** Name them. "Packages published by older builds" is only a population if such packages exist.
  2. **How were they checked?** With what query, against what store, and when. A read-only query of the store that actually holds the artifacts is the standard; an assumption is not a check.
  3. **Which behavior must remain compatible?** The specific outcome that would break, and for whom.
- **Green tests show that code meets its contract; they do not show the contract's premise is true.** A tolerance can be fully covered by tests, every test green, and still defend nothing — because the tests assert what the code does, never whether the population it protects is empty. A tier is not validated by having tests; it is validated by evidence, and the tests then only pin the behaviour the evidence justified.
- **A compatibility tier that has been shown unnecessary is deleted, not kept as a vestige.** Keeping an unused mode retains its implementation and test burden while preserving no production path, and a switch with one reachable value misrepresents the contract to the next reader. The settled case: the `.lcpack` read tier promised that shares published before payload validation existed had to stay cloneable; a read-only query of the remote D1 `shares` table found the population empty (the table was created by a migration never applied remotely, so no `.lcpack` had ever been published), the tier was deleted, and the real defect it had been masking — the Question Bank having no payload validator at all — was found and fixed. **The cost of a tolerance is not the branch. It is that it converts a refusal into a note, and a note is not a gate.**

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
| `scripts/AGENTS.md` | `scripts/` | Build & content tooling — publisher seeder CLI, pure `.lcpack` package builder |
| `tests/e2e/AGENTS.md` | `tests/e2e/` | Playwright acceptance suite — share-clone seeding contract, helpers, committed fixtures |

