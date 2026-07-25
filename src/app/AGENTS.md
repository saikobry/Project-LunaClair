# src/app/ — Application Shell

## Purpose

Application-level orchestration: the root shell layout, configuration constants, and React providers. Owns the top-level rendering tree but contains no business logic.

## Ownership

- `layouts/AppShell.tsx` — root layout shell with header, sidebar, and content areas
- `config/constants.ts` — app-wide constants (app name, studio name)
- `providers/` — React context providers (currently empty, reserved for future cross-feature state)
- `index.ts` — barrel export of public API

## Local Contracts

- No business logic lives here. Business rules belong in `src/domain/` or feature modules.
- Providers are added only when cross-feature state sharing is needed.
- Layout components are styling-only — they arrange children, they don't fetch data.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
