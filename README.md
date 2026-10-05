# Project LunaClair

**Studio:** Saiko Interactive

Project LunaClair is an AI-powered learning platform. The long-term vision is to transform learning materials into structured study datasets that power quizzes, flashcards, practice exams, progress tracking, and other study experiences.

**Current status:** v0.3.0 — the legacy content catalog is retired and `.lcpack` StudyPackage sharing is the sole content-distribution path. Cloud sync (outbox, D1 replication, conflict resolution) is implemented.

## Tech Stack

| Technology | Role |
|---|---|
| React 19 + TypeScript (strict) | UI framework |
| Vite 8 | Build tool |
| Lexical (`@lexical/*`) | WYSIWYG authoring engine & Markdown transformers |
| StyleX | Styling, design tokens (`*.stylex.ts`) |
| @astryxdesign/core + theme-neutral | UI component kit and theme |
| TanStack Query | Server-state caching & mutations (`networkMode: 'offlineFirst'`) |
| Dexie.js | IndexedDB persistence (Schema v15) |
| GSAP | Animation, viewport morphing, and drag interactions |
| react-markdown + remark-gfm + rehype-slug | Markdown rendering |
| vite-plugin-pwa | PWA / offline app shell |
| Cloudflare Workers + D1 + Workers AI | Edge API, serverless SQLite cloud sync/shares, Llama 3.3 LLM |
| Vitest + Testing Library | Unit, transformer, fidelity, state & persistence test suite (2,400+ tests) |
| Playwright | Real-browser E2E acceptance tests |

## Features

| Feature | Status | Scope |
|---|---|---|
| `materials/` | ✅ Implemented | Local study material management — material entities, `MaterialCard`, `MaterialGrid`, `LibraryView`, CRUD modals |
| `collections/` | ✅ Implemented | User-curated material collections with custom ordering and collection modals |
| `subjects/` | ✅ Implemented | Academic subject hierarchy — subject entities, workspaces, cards, CRUD modals |
| `terms/` | ✅ Implemented | Academic terms & subject-term junctions — term management, usage counters, and association modals |
| `discovery/` | ✅ Implemented | Content discovery & Explore Hub — remote catalog exploration, community shares, and read-only previews |
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, table of contents |
| `quiz/` | ✅ Implemented | Assessment engine — 5 question types, quiz player, session flow, subject quiz explorer |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, visual Quiz Canvas builder, per-type editors, publish/archive workflows |
| `flashcards/` | ✅ Implemented | SM-2 spaced repetition, 3D flip-card player, rating flow |
| `writer/` | ✅ Implemented | Lexical WYSIWYG authoring with lossless Markdown transformation |
| `analytics/` | ✅ Implemented | Study overview KPIs, card maturity distribution, 7-day review forecast, subject mastery matrix, and 52-week activity heatmap |
| `ai/` | ✅ Implemented | AI Study Assistant & Content Generation — Grounded chat drawer (`Llama 3.3 70B Instruct`), selection actions, question & flashcard generators |
| `importer/` | ✅ Implemented | Content Importer — 5-step wizard, hybrid PDF.js + Tesseract OCR extraction, dual-pane Lexical review |
| `sync/` | ✅ Implemented | Cloud Synchronization — Transactional outbox, hybrid D1 replication, offline convergence, conflict resolution modal |
| `package/` | ✅ Implemented | Collaboration & Sharing — Portable `.lcpack` bundles, cloud share links (`/share/:id`, `/s/:code`), passcode protection |

## Repository Structure

```
docs/               — Roadmap, architecture guide, ADRs, UI guidelines
src/
├── app/            — Application shell, layouts, navigation slices, routing, screens, composition root
├── application/    — Framework-agnostic application use cases and domain slice factories
├── domain/         — Business domain models, engines, ports, reconcilers (pure data, no UI)
├── features/       — Bounded capability feature modules (materials, subjects, terms, reader, quiz, etc.)
├── infrastructure/ — Persistence and API layer (database, API transports, browser lifecycle, importer)
├── shared/         — Domain-agnostic types, constants, hooks, UI primitives
└── styles/         — Global styles and master stylesheet
```

## Architecture

- **Layered:** presentation (`app/screens/` + `features/`) → application use cases (`application/`) → domain contracts (`domain/`) → infrastructure repositories (`infrastructure/`, Dexie/IndexedDB).
- **Pragmatic CQRS (ADR-011):** The composition root exposes pure Domain Port repositories (`context.repositories`) for TanStack Query read models and application use-cases (`context.useCases`) for write mutations and business workflows.
- **Screen Layer Orchestration (ADR-014):** Features own reusable capabilities; route-level orchestration and cross-feature compositions reside in `src/app/screens/`.
- **Infrastructure Taxonomy (ADR-015):** Persistence and runtime adapters are organized into boundary-first subsystems (`database/`, `api/`, `browser/`, `importer/`, `storage/`).
- **Cloudflare Worker Architecture (ADR-016):** Modular Web Standards declarative router with isolated domain route handlers and mock D1 testing harness.
- **Caching:** TanStack Query runs with `networkMode: 'offlineFirst'` for queries *and* mutations so IndexedDB-backed operations never pause when offline.
- **Domain purity:** domain modules import only from other domains or pure libraries — never React, features, or infrastructure.
- **Feature contracts (ADR-010):** feature-root barrels are strictly prohibited; all cross-feature consumers use approved direct module paths.
- Key decisions are recorded as ADRs in [docs/architecture/adr/](docs/architecture/adr/README.md) (ADR-001 through ADR-016).

See [docs/architecture/architecture.md](docs/architecture/architecture.md) for the full guide.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Unit & Integration Tests | `npm run test:run` / `npm run test` / `npm run test:coverage` |
| E2E Acceptance Tests | `npm run test:e2e` |
| Preview production build | `npm run preview` (proxies `/api` to **production**) |
| Preview against staging Worker | `npm run preview:staging` (proxies `/api` to the isolated staging Worker) |
| Regenerate PWA icons | `npm run generate:pwa-assets` |
| Dev API Worker | `npm run dev:api` |
| Deploy API Worker | `npm run deploy:api` (production) |
| Deploy API Worker to staging | `npm run deploy:api:staging` |
| Dev API Worker (staging env) | `npm run dev:api:staging` |
| Apply D1 migrations (staging) | `npm run db:apply:staging:local` / `npm run db:apply:staging:remote` |
| List pending staging migrations | `npm run db:list:staging` |
| Regenerate Worker types | `npm run types:worker` |
| Generate D1 migration | `npm run db:generate` |
| Apply D1 migrations | `npm run db:apply:local` / `npm run db:apply:remote` |
| Seed StudyPackage shares | `npm run seed:shares:local` / `npm run seed:shares:remote` (dry-run validators) |

**Build process:** `tsc -b` (type-check) then `vite build`. No separate typecheck command — `npm run build` covers it.

**Testing:** Vitest (`vitest`) for unit, fidelity, Dexie persistence, and UI state tests; Playwright (`@playwright/test`) for real Chromium E2E acceptance tests.

## PWA / Offline

- Installable, offline-capable PWA. `vite-plugin-pwa` emits a service worker precaching the lightweight app shell (~2.9 MB across 56 entries), plus a web manifest (`display: standalone`, white theme). SW registration and the manifest link are auto-injected at build — no manual `registerSW` call.
- **Content distribution is `.lcpack` StudyPackage sharing only.** The legacy content catalog and its raw document/figure endpoints are retired; `POST /api/shares` plus `SharedPackageScreen` is the exclusive mechanism. A fresh install starts with an empty library — users build it from the Explore Hub by cloning published shares. Canonical sources live at `content/materials/`, transformed by `scripts/lib/studyPackageBuilder.mjs` and published via `node scripts/seed-shares.mjs`; the `seed:shares:*` npm scripts are **dry-run validators only**.
- Imported materials are read from IndexedDB, never re-fetched — including `lc-asset://` figures, which resolve to local object URLs.
- Install discovery: quiet opt-in `Install app` / `Add to Home Screen` sidebar entry plus a one-time iOS-only card from the second visit. Deliberately no `beforeinstallprompt` machinery.
- Offline synchronization is **implemented** — a transactional outbox, D1 replication with optimistic versioning, and conflict resolution. Cloudflare D1 is the sync/sharing backing store; IndexedDB remains the source of truth for library membership.
- Icons regenerate from `public/app-icon.svg` via `npm run generate:pwa-assets`.

## Linter

Uses **oxlint** (config at `.oxlintrc.json`). Plugins: `react`, `typescript`, `oxc`. Rules: `react/rules-of-hooks` (error), `react/only-export-components` (warn).

## Conventions & Skills

- Testing frameworks: Vitest + Playwright.
- Agent skills live in `.agents/skills/`:
  - **commit-message** — generates conventional commits from staged changes
  - **react-doctor** — scans React code for anti-patterns, performance, security, architecture, accessibility (run after React changes)
  - **architecture-chronicle** — captures architecture, data flows, and system evolution after a phase
  - **community-question** — drafts paste-ready forum questions grounded in the codebase
  - **playwright-skill** — Playwright patterns for E2E and component testing
  - **review** — Audits Playwright tests against best practices
- No `prettier`, `eslint`, or `biome` — oxlint only.
