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
**Phase:** 0 (Foundation)

## Stack

React 19 + TypeScript + Vite.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |

**Build process**: `tsc -b` (type-check) then `vite build`. No separate typecheck command — `npm run build` covers it.

**No test framework** is configured. No test scripts or test files exist.

## Linter

Uses **oxlint** (not ESLint). Config at `.oxlintrc.json`.
Plugins: `react`, `typescript`, `oxc`.
Rules: `react/rules-of-hooks` (error), `react/only-export-components` (warn).

## Architecture

Feature-based architecture:

```
src/
  app/        — Application shell, config, providers
  domain/     — Business domain models (pure data, no UI)
  features/   — Feature modules (reader, quiz, library, …)
  shared/     — Shared types, constants, utilities, base components
  services/   — Infrastructure services (storage, IndexedDB, …)
  styles/     — Global styles and master stylesheet
```

See `docs/architecture.md` for full details.

## TypeScript

Two tsconfig files:
- `tsconfig.app.json` — covers `src/` (app code)
- `tsconfig.node.json` — covers `vite.config.ts` (tooling)

Strict flags: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`.

## Import Rules

1. **No cross-feature imports** — features never import from other features.
2. **Domain modules** import only from other domains or pure libraries — never from React, features, or services.
3. **Shared code** — if two features need the same type/constant/utility, extract to `shared/`.
4. **Services** import from `shared/` (types) but not from features.
5. **Barrel exports** (`index.ts`) re-export selectively — avoid deep import chains.

## Conventions

- No CI, no tests, no formatting config (beyond oxlint).
- Commit messages: use `commit-message` skill (`.agents/skills/commit-message/SKILL.md`) — generates conventional commits from staged changes.
- React code quality: use `react-doctor` skill (`.agents/skills/react-doctor/SKILL.md`) — scans for React anti-patterns, performance, security, architecture, accessibility. Run after any React code changes.
- No `prettier`, `eslint`, or `biome`. Do not add them without asking.

## User Preferences

- Agent should keep documentation lean and operational — prefer concise bullets over prose.
- When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md.

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/app/AGENTS.md` | `src/app/` | Application shell, layout, config, providers |
| `src/domain/AGENTS.md` | `src/domain/` | Business domain models and logic |
| `src/features/AGENTS.md` | `src/features/` | Feature module policies and orchestration |
| `src/features/reader/AGENTS.md` | `src/features/reader/` | Reader feature — highlighting, drawing, markdown rendering |
| `src/services/AGENTS.md` | `src/services/` | Infrastructure services (storage, IndexedDB) |
| `src/shared/AGENTS.md` | `src/shared/` | Shared types, constants, utilities, hooks, components |
