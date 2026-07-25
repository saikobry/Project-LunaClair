# src/features/ — Feature Modules

## Purpose

Feature-based modules, each containing everything needed for that feature: components, hooks, assets, types, styles, and utilities. Features are isolated — they import from `shared/`, `domain/`, or `services/`, but not from other features.

## Ownership

| Feature | Status | Scope |
|---|---|---|
| `reader/` | ✅ Implemented | Markdown rendering, highlights, drawing canvas, TOC |
| `library/` | ✅ Implemented | Study Library — material grid, CRUD modals, content resolution |
| `quiz/` | 🔒 Reserved | Quiz engine |
| `importer/` | 🔒 Reserved | Content import |
| `generator/` | 🔒 Reserved | AI content generation |
| `settings/` | 🔒 Reserved | App settings |

## Local Contracts

- **No cross-feature imports.** A feature must not import from another feature.
- Each feature contains its own: components/, hooks/, types/, utils/, services/, styles/, assets/
- Feature orchestrator: `{Feature}Screen.tsx` — wires hooks to views
- Feature view: `{Feature}View.tsx` — pure presentation
- Barrel export: `index.ts` re-exports the public API (usually just the Screen component)

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
