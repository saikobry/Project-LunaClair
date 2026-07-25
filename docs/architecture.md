# Project LunaClair — Architecture Guide

**Studio:** Saiko Interactive
**Version:** Phase 0 (Foundation)

---

## Folder Philosophy

```
src/
├── app/          # Application bootstrap: shell layout, config, providers
├── domain/       # Business domain models (pure data, no UI)
├── features/     # Feature modules (feature-based, isolated)
├── shared/       # Shared library: types, constants, utils, base components
├── services/     # Infrastructure services (storage, IndexedDB, future Firebase)
└── styles/       # Global styles and master stylesheet
```

### `src/app/`
Application-level orchestration: the root shell layout (`AppShell`), configuration constants, and React providers. This layer owns the top-level rendering tree but contains **no business logic**.

### `src/domain/`
Pure business domain models and logic — interfaces, types, and pure functions that describe the problem space. Domain modules must have **zero React or UI dependencies**. They are importable by any feature or service.

Reserved domains:
| Domain | Purpose |
|---|---|
| `reader/` | Document reading, annotations, highlighting |
| `quiz/` | Quiz engine models (questions, answers, sessions) |
| `library/` | Document/library catalog models |
| `generator/` | AI content generation models |

### `src/features/`
Feature-based modules, each containing everything needed for that feature: components, hooks, assets, types, styles, and utilities. Features are **isolated** — they import from `shared/`, `domain/`, or `services/`, but not from other features.

Active features:
| Feature | Status |
|---|---|
| `reader/` | ✅ Implemented (Phase 0) |
| `library/` | 🔒 Reserved |
| `quiz/` | 🔒 Reserved |
| `importer/` | 🔒 Reserved |
| `generator/` | 🔒 Reserved |
| `settings/` | 🔒 Reserved |

### `src/shared/`
Truly shared code: reusable types, constants, utility functions, and base UI components that multiple features may consume. Nothing in `shared/` should depend on any feature module.

### `src/services/`
Infrastructure adapters: localStorage wrappers, IndexedDB helpers, and eventually Firebase/Auth/API clients. Services abstract side effects so features can remain testable and decoupled.

### `src/styles/`
Global CSS, CSS variables, and the master `index.css` that composes global + app shell + feature stylesheets.

---

## Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Feature orchestrator | `{Feature}Screen.tsx` | `ReaderScreen.tsx` |
| Feature view (presentation) | `{Feature}View.tsx` | `ReaderView.tsx` |
| Custom hook | `use{Responsibility}.ts` | `useHighlights.ts` |
| Feature types | `{feature}.types.ts` | `reader.types.ts` |
| Stylesheet | `{feature}.css` | `reader.css` |
| Barrel export | `index.ts` per folder | — |

---

## Import Rules

1. **No cross-feature imports.** A feature must not import from another feature.
2. **Domain modules import only from other domains or pure libraries** — never from React, features, or services.
3. **Shared code lives in `shared/`** — if two features need the same type, constant, or utility, extract it to `shared/`.
4. **Services import from `shared/` (types) but not from features.**
5. **Barrel exports** (`index.ts`) should re-export selectively — avoid deep import chains.

---

## Component Hierarchy

```
<App>
  <AppShell>
    <ReaderScreen>
      <ReaderView>
        <MarkdownViewer />
        <DrawingCanvas />
        <SelectionPopover />
        <AnnotationToolbar />
      </ReaderView>
      <Toc />
    </ReaderScreen>
  </AppShell>
</App>
```

---

## State Management Philosophy

- Feature-local state lives in React hooks within the feature module.
- Cross-feature state will be introduced via React Context (in `app/providers/`) as needed.
- Persistence is abstracted behind `services/storage/` — features call storage helpers, never `localStorage` directly.
- No external state management library is used unless justified later.
