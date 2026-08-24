# Project LunaClair

**Studio:** Saiko Interactive

Project LunaClair is an AI-powered learning platform. The long-term vision is to transform learning materials into structured study datasets that power quizzes, flashcards, practice exams, progress tracking, and other study experiences.

**Current status:** Phase 7 (Analytics & Learning Insights) is complete. Next planned phase is Phase 8 (AI Study Assistant).

## Tech Stack

| Technology | Role |
|---|---|
| React 19 + TypeScript (strict) | UI framework |
| Vite 8 | Build tool |
| Lexical (`@lexical/*`) | WYSIWYG authoring engine & Markdown transformers |
| StyleX | Styling, design tokens |
| @astryxdesign/core + theme-neutral | UI component kit and theme |
| TanStack Query | Server-state caching & mutations (`networkMode: 'offlineFirst'`) |
| Dexie.js | IndexedDB persistence |
| GSAP | Animation, drag interactions |
| react-markdown + remark-gfm + rehype-slug | Markdown rendering |
| vite-plugin-pwa | PWA / offline app shell |
| Vitest + Testing Library | Unit, transformer, fidelity, state & persistence test suite |
| Playwright | Real-browser E2E acceptance tests |

## Features

| Feature | Status | Scope |
|---|---|---|
| `catalog/` | ✅ Implemented | Study content organization — Library (materials), subject workspaces, and term management |
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, table of contents |
| `quiz/` | ✅ Implemented | Assessment engine — 5 question types, quiz player, session flow, subject quiz explorer |
| `quiz-management/` | ✅ Implemented | Question Bank authoring, Quiz Catalog builder, per-type editors, publish/archive workflows |
| `flashcards/` | ✅ Implemented | SM-2 spaced repetition, 3D flip-card player, rating flow |
| `writer/` | ✅ Implemented | Lexical WYSIWYG authoring with lossless Markdown transformation |
| `analytics/` | ✅ Implemented | Study overview KPIs, card maturity distribution, 7-day review forecast, subject mastery matrix, and 52-week activity heatmap |
| `importer/` | 🔒 Reserved | Content import |
| `generator/` | 🔒 Reserved | AI content generation |

## Repository Structure

```
docs/               — Roadmap, architecture guide, ADRs, UI guidelines
src/
├── app/            — Application shell, layouts, providers, composition root
├── application/    — Framework-agnostic application use cases
├── domain/         — Business domain models (pure data, no UI)
├── features/       — Feature modules (catalog, reader, quiz, quiz-management, flashcards, writer)
├── infrastructure/ — Persistence and API layer (Dexie database, repositories, Worker adapters)
├── shared/         — Domain-agnostic types, constants, hooks, UI primitives
└── styles/         — Global styles and master stylesheet
```

## Architecture

- **Layered:** presentation (`app/` + `features/`) → application use cases (`application/`) → domain contracts (`domain/`) → infrastructure repositories (`infrastructure/`, Dexie/IndexedDB).
- **Dependency injection:** the composition root in `src/app/bootstrap` creates repositories and use cases; `ApplicationProvider` supplies one stable application graph through React Context. Query hooks access repositories via DI; mutation hooks delegate workflows to use cases.
- **Caching:** TanStack Query runs with `networkMode: 'offlineFirst'` for queries *and* mutations so IndexedDB-backed operations never pause when offline.
- **Domain purity:** domain modules import only from other domains or pure libraries — never React, features, or infrastructure.
- **Feature contracts:** feature-root barrels are prohibited by ADR-010; cross-feature consumers use the approved direct module paths, while internal feature paths remain private.
- Key decisions are recorded as ADRs in [docs/architecture/adr/](docs/architecture/adr/README.md) — repository pattern, React Context DI, TanStack Query, Dexie, strategy pattern, immutable quiz history, feature-first architecture, feature ownership.

See [docs/architecture/architecture.md](docs/architecture/architecture.md) for the full guide.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Unit & Integration Tests | `npm run test:run` / `npm run test` / `npm run test:coverage` |
| E2E Acceptance Tests | `npm run test:e2e` |
| Preview production build | `npm run preview` |
| Regenerate PWA icons | `npm run generate:pwa-assets` |
| Dev API Worker | `npm run dev:api` |
| Deploy API Worker | `npm run deploy:api` |
| Regenerate Worker types | `npm run types:worker` |
| Generate D1 migration | `npm run db:generate` |
| Apply D1 migrations | `npm run db:apply:local` / `npm run db:apply:remote` |

**Build process:** `tsc -b` (type-check) then `vite build`. No separate typecheck command — `npm run build` covers it.

**Testing:** Vitest (`vitest`) for unit, fidelity, Dexie persistence, and UI state tests; Playwright (`@playwright/test`) for real Chromium E2E acceptance tests.

## PWA / Offline

- Installable, offline-capable PWA. `vite-plugin-pwa` emits a service worker precaching the lightweight app shell (~1.5 MB), plus a web manifest (`display: standalone`, white theme). SW registration and the manifest link are auto-injected at build — no manual `registerSW` call.
- Study materials (documents & figures) live in Cloudflare D1, served on-demand by the `api` Worker and cached by the service worker via Workbox `CacheFirst` runtime caching (materials work offline after their first open).
- Canonical study materials live at `content/materials/` and are seeded to D1 via `npm run seed:materials:local` / `npm run seed:materials:remote`.
- Install discovery: quiet opt-in `Install app` / `Add to Home Screen` sidebar entry plus a one-time iOS-only card from the second visit. Deliberately no `beforeinstallprompt` machinery.
- Offline synchronization (sync queue, conflict resolution) is **Phase 10** scope; offline-readiness is shipped.
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
