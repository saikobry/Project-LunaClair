# src/app/ — Application Shell

## Purpose

Application-level orchestration: the root shell layout, configuration constants, and React providers. Owns the top-level rendering tree but contains no business logic.

## Ownership

- `layouts/AppShell.tsx` — Root layout shell that manages top-level navigation (`library` | `reader` screens), document resolution, and screen switching
- `bootstrap.ts` — Application initialization: registers content sources, seeds demo data into `libraryRepository`
- `config/constants.ts` — App-wide constants (app name, studio name)
- `providers/AppProviders.tsx` — Astryx `<Theme>` provider (wraps app with neutral theme); future providers (TanStack Query, toast, auth) added here
- `index.ts` — Barrel export of public API

## Local Contracts

- High-level orchestration only. Business rules belong in `src/domain/` or feature modules.
- Providers are added only when cross-feature state sharing is needed.
- `bootstrap.ts` runs once at app startup (from `App.tsx` `useEffect`) — it seeds demo data and registers content before any screen renders.
- `AppShell.tsx` owns screen state (`'library'` / `'reader'`) and resolves `StudyMaterial` → `Document` via `contentService`.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
