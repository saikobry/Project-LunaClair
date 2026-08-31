# src/app/ — Application Shell & Composition Root

## Purpose

Application-level orchestration: the root shell layout, composition root & DI factories, routing engine, React context providers, and transient system overlays. Owns the top-level rendering tree but contains no domain business logic.

## Ownership

- `bootstrap/` — Composition root: `createApplication()` composes the entire dependency graph by calling `createInfrastructure()` (instantiating Dexie repositories, Cloudflare transports, domain services, and reconcilers) and `createUseCases()` (delegating domain slice creation to 8 modular factories in `bootstrap/use-cases/`). Exposes `{ repositories, useCases, infrastructure }` to `ApplicationContext` (ADR-011).
- `bootstrap.ts` — Application initialization: calls `DatabaseInitializer.initialize()` (opens Dexie database, runs legacy localStorage migration — **no seeding**; a fresh install boots with an empty library).

- `providers/` — React Context Providers:
  - `providers/AppProviders.tsx` — Astryx `<Theme>`, TanStack `<QueryClientProvider>`, `<ApplicationProvider>`, and `<ToastProvider>` for user action notifications.
  - `providers/ApplicationContext.ts` — React context definition exposing the application graph (`{ repositories, useCases, infrastructure }`, ADR-011).
  - `providers/ApplicationProvider.tsx` — React context provider supplying one stable application graph singleton (initialized via `useState` lazy initializer, clean React 19 Concurrent render semantics) to all feature hooks.
  - `providers/FocusModeContext.tsx` — Cross-cutting Focus Mode context (`FocusModeProvider` + `useFocusMode`), provided by `AppShell` so deeply-nested toolbars (reader, quiz canvas) react to the mode without prop-drilling.

- `routing/` — Navigation Engine & View Switcher:
  - `routing/routing.ts` — `AppRoute` union types, URL path parser (`urlToRoute`), and URL serializers (`routeToUrl`).
  - `routing/useAppRoute.ts` — `useAppRoute` hook: parses URL on mount, syncs URL on navigation via `pushState`, and tracks `popstate` history.
  - `routing/ShellRoutes.tsx` — Per-route screen switcher table: conditionally renders route screens (Library / Explore / Preview / Terms / Analytics / Subject / MaterialWorkspace / QuizCanvasBuilder / QuizScreen) with `lazy()` and `<Suspense>` boundaries.

- `layouts/` — Structural Frame & Page Containers:
  - `layouts/AppShell.tsx` — Thin composition root: wires `useAppRoute`, `useShellFocusMode`, `useFocusModeMotion` (GSAP rail/FAB animation), `AppSidebar`, `<ShellRoutes>`, and mounts transient overlays from `overlays/`.
  - `layouts/AppSidebar.tsx` — Global navigation rail (desktop sidebar, tablet rail, mobile bottom dock) with GSAP sliding active pill, sync status pill, and brand footer.
  - `layouts/MaterialWorkspace.tsx` — Composite material workspace (Read / Write / Quiz / Flashcards / Manage tab bar) orchestrating reader, writer, quiz, flashcard, and AI chat features.
  - `layouts/useShellFocusMode.ts` — Focus Mode state hook (`STORAGE_KEYS.settings.focusMode`, `Cmd/Ctrl+B` toggle).

- `overlays/` — Transient System UI (Out of Document Flow):
  - `overlays/OfflineBanner.tsx` — Global connectivity status indicator (`zIndex: 200`). Draggable, auto-collapsing offline pill with magnetic screen border snapping.
  - `overlays/OnboardingTutorial.tsx` — First-run welcome tutorial full-screen takeover rendered as a native `<dialog>` (`showModal()`). Finish and Skip sync default terms via `SyncDefaultTermsUseCase`.
  - `overlays/InstallPrompt.tsx` — PWA install surfaces: one-time iOS install card (`InstallPrompt`) and platform-aware instructions dialog (`InstallInstructionsDialog`).
  - `overlays/installDetection.ts` — Pure PWA detection helpers: `isIOS()` and `isStandalone()`.

## Local Contracts

- High-level orchestration only. Business workflows belong in `src/application/`; domain rules belong in `src/domain/`.
- Providers are added only when cross-feature state sharing is needed.
- `bootstrap.ts` runs once at app startup (from `App.tsx` `useEffect`) — it initializes the database layer via `DatabaseInitializer`. No auto-hydration: the catalog is fetched independently when the Available UI requires it, and materials are imported on user action.
- `AppShell.tsx` mounts `OfflineBanner` as global chrome. TanStack Query's `networkMode: 'offlineFirst'` default for queries and mutations (set in `providers/AppProviders.tsx`) is a hard requirement for offline operation.
- Route state lives in `useAppRoute` via the `AppRoute` union. Navigation helpers live in `src/app/routing/routing.ts`.
- Focus Mode contract: `useShellFocusMode` owns `isFocusMode` (initialized from `localStorage`, persisted on every toggle) and `AppShell` passes `isFocusMode` + `onToggleFocusMode` to `AppSidebar`. `Cmd+B` (macOS) / `Ctrl+B` (Windows/Linux) toggles it from any page.
- Query hooks access domain repositories through DI context (`context.repositories.*`, ADR-011). Mutation hooks and domain workflows call `ApplicationContext.useCases.*` and never import concrete implementations directly. Shell-level bootstrap coordinates infrastructure via `context.infrastructure.*`.
- First-run onboarding contract: one-time per browser, skippable, rendered as a native `<dialog>`. Syncs default terms via `SyncDefaultTermsUseCase` on Finish AND Skip.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:run`

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
