# src/app/ — Application Shell

## Purpose

Application-level orchestration: the root shell layout, configuration constants, and React providers. Owns the top-level rendering tree but contains no business logic.

## Ownership

- `layouts/AppShell.tsx` — Root layout shell that manages top-level navigation via `AppRoute` discriminated union (`library` | `reader` | `quiz` | `manage-quiz`). Passes `StudyMaterial` to `ReaderScreen` and `QuizManagementScreen`, `QuizLaunchRequest` to `QuizScreen`.
- `bootstrap.ts` — Application initialization: calls `DatabaseInitializer.initialize()` (opens Dexie database, runs legacy localStorage migration, seeds demo data if empty)
- `config/constants.ts` — App-wide constants (app name, studio name)
- `providers/AppProviders.tsx` — Astryx `<Theme>`, TanStack `<QueryClientProvider>`, `<RepositoryProvider>` (dependency-injected repositories), and `<ToastProvider>` for user action notifications
- `providers/RepositoryContext.ts` — React context definition holding `LibraryRepository`, `DocumentRepository`, `AnnotationRepository`, `QuestionRepository`, `QuizRepository`, and `QuizSessionRepository`
- `providers/RepositoryProvider.tsx` — React context provider supplying stable singleton Dexie repositories to all feature hooks
- `index.ts` — Barrel export of public API

## Local Contracts

- High-level orchestration only. Business rules belong in `src/domain/` or feature modules.
- Providers are added only when cross-feature state sharing is needed.
- `bootstrap.ts` runs once at app startup (from `App.tsx` `useEffect`) — it initializes the database layer via `DatabaseInitializer`. No content registration needed (documents are static assets in `public/materials/`).
- `AppShell.tsx` owns route state via `AppRoute` union (`{ name: 'library' }` | `{ name: 'reader'; material }` | `{ name: 'quiz'; launchRequest }` | `{ name: 'manage-quiz'; material }`). Document resolution is delegated to the reader feature's `useDocument` hook. Quiz entry points emit `QuizLaunchRequest` from Library and Reader screens. Quiz management navigates via `StudyMaterial`.
- Feature hooks access repositories via dedicated DI hooks (`useLibraryRepository()`, `useDocumentRepository()`, `useAnnotationRepository()`, `useQuestionRepository()`, `useQuizRepository()`, `useQuizSessionRepository()`), never by importing concrete implementations directly.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
