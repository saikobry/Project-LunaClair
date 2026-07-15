# AGENTS.md

## What this is

React 19 + TypeScript + Vite project. Produces a single HTML file via `vite-plugin-singlefile`.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |

**Build order**: `tsc -b` runs first (type-check), then `vite build`. There is no separate typecheck command — `npm run build` covers it.

**No test framework** is configured. There are no test scripts or test files.

## Linter

Uses **oxlint** (not ESLint). Config at `.oxlintrc.json`.

Plugins enabled: `react`, `typescript`, `oxc`.
Key enforced rules: `react/rules-of-hooks` (error), `react/only-export-components` (warn).

## TypeScript

Two tsconfig files:
- `tsconfig.app.json` — covers `src/` (app code)
- `tsconfig.node.json` — covers `vite.config.ts` (tooling)

Strict options: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`.

## Build output

`npm run build` produces a self-contained `dist/index.html` with all JS/CSS inlined. No separate asset files.

## Conventions

- No CI, no tests, no formatting config (beyond oxlint).
- Commit messages: use the `commit-message` skill (`.agents/skills/commit-message/SKILL.md`) — generates conventional commits from staged changes.
- No `prettier`, `eslint`, or `biome` in use. Do not add them without asking.
