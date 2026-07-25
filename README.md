# Project LunaClair

**Studio:** Saiko Interactive

Project LunaClair is an AI-powered learning platform. The long-term vision is to transform learning materials into structured study datasets that power quizzes, flashcards, practice exams, progress tracking, and other study experiences.

## Phase 0 — Foundation

This phase restructures the existing Markdown reviewer prototype into a maintainable, feature-based architecture while preserving 100% of existing functionality and runtime behavior.

## Repository Structure

```
docs/               — Architecture and design documentation
src/
├── app/            — Application shell, config, providers
├── domain/         — Business domain models
├── features/       — Feature modules (reader, quiz, library, …)
├── shared/         — Shared types, constants, utilities, components
├── services/       — Infrastructure services (storage, IndexedDB, …)
└── styles/         — Global styles and master stylesheet
```

See [docs/architecture.md](docs/architecture.md) for a full architectural guide.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |

**Build order:** `tsc -b` runs first (type-check), then `vite build`.

## Linter

Uses **oxlint** (config at `.oxlintrc.json`). Plugins: `react`, `typescript`, `oxc`.
