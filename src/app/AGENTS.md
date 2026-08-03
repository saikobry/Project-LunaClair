# src/app/ — Application Shell

## Purpose

Application-level orchestration: the root shell layout, configuration constants, and React providers. Owns the top-level rendering tree but contains no business logic.

## Ownership

- `layouts/AppShell.tsx` — Root layout shell that manages top-level navigation via `AppRoute` discriminated union (`library` | `terms` | `subject` | `workspace` | `quiz-session`). Subject routes carry `activeTab: 'materials' | 'quiz' | 'terms'` serialized as `?tab=`.
- `bootstrap/` — Composition root: creates repositories, use cases, and the application graph.
- `bootstrap.ts` — Application initialization: calls `DatabaseInitializer.initialize()` (opens Dexie database, runs legacy localStorage migration, seeds demo data if empty)
- `config/constants.ts` — App-wide constants (app name, studio name)
- `providers/AppProviders.tsx` — Astryx `<Theme>`, TanStack `<QueryClientProvider>`, `<ApplicationProvider>` (dependency-injected repositories + application services), and `<ToastProvider>` for user action notifications
- `providers/ApplicationContext.ts` — React context definition exposing the application graph (`useCases` plus repositories during migration)
- `providers/ApplicationProvider.tsx` — React context provider supplying one stable application graph to all feature hooks
- `index.ts` — Barrel export of public API

## Local Contracts

- High-level orchestration only. Business workflows belong in `src/application/`; domain rules belong in `src/domain/`.
- Providers are added only when cross-feature state sharing is needed.
- `bootstrap.ts` runs once at app startup (from `App.tsx` `useEffect`) — it initializes the database layer via `DatabaseInitializer`. No content registration needed (documents are static assets in `public/materials/`).
- `AppShell.tsx` owns route state via `AppRoute` union (`{ name: 'library' }` | `{ name: 'reader'; material }` | `{ name: 'quiz'; launchRequest }` | `{ name: 'manage-quiz'; material }`). Document resolution is delegated to the reader feature's `useDocument` hook. Quiz entry points emit `QuizLaunchRequest` from Library and Reader screens. Quiz management navigates via `StudyMaterial`.
- Query hooks may access repositories through DI during migration. Mutation hooks call `ApplicationContext.useCases` and never import concrete implementations directly.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
