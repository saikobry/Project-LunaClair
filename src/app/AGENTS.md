# src/app/ — Application Shell & Composition Root

## Purpose

Application-level orchestration: the root shell layout, composition root & DI factories, routing engine, React context providers, and transient system overlays. Owns the top-level rendering tree but contains no domain business logic.

## Ownership

- `bootstrap/` — Composition root: `createApplication()` composes the entire dependency graph by calling `createInfrastructure()` (instantiating Dexie repositories including `collection`/`collectionMaterial`, Cloudflare transports, domain services, and reconcilers) and `createUseCases()` (delegating domain slice creation to 9 modular factories in `bootstrap/use-cases/`, including `createCollectionUseCases`). Exposes `{ repositories, useCases, infrastructure }` to `ApplicationContext` (ADR-011).
- `bootstrap.ts` — Application initialization: calls `DatabaseInitializer.initialize()` (opens Dexie database, runs legacy localStorage migration — **no seeding**; a fresh install boots with an empty library).

- `providers/` — React Context Providers:
  - `providers/AppProviders.tsx` — Astryx `<Theme>`, TanStack `<QueryClientProvider>`, `<ApplicationProvider>`, and `<ToastProvider>` for user action notifications.
  - `providers/ApplicationContext.ts` — React context definition exposing the application graph (`{ repositories, useCases, infrastructure }`, ADR-011).
  - `providers/ApplicationProvider.tsx` — React context provider supplying one stable application graph singleton (initialized via `useState` lazy initializer, clean React 19 Concurrent render semantics) to all feature hooks.
  - `providers/FocusModeContext.tsx` — Cross-cutting Focus Mode context (`FocusModeProvider` + `useFocusMode`), provided by `AppShell` so deeply-nested toolbars (reader, quiz canvas) react to the mode without prop-drilling.

- `routing/` — Navigation Engine & View Switcher:
  - `routing/routing.ts` — `AppRoute` union types, URL path parser (`urlToRoute`), and URL serializers (`routeToUrl`).
  - `routing/useAppRoute.ts` — `useAppRoute` hook: parses URL on mount, syncs URL on navigation via `pushState`, and tracks `popstate` history.  - `routing/ShellRoutes.tsx` — Per-route screen switcher table: conditionally renders route screens (Library / Explore / Terms / Analytics / Subject / Collection / MaterialWorkspace / QuizCanvasBuilder / QuizScreen) with `lazy()` and `<Suspense>` boundaries.

- `screens/` — Application Screen & Route Composition Layer (ADR-014):
  - Route-level screens and cross-feature orchestrations:
    - `screens/library/` — `LibraryHomeScreen.tsx` & `LibraryModals.tsx` (aggregates material and subject management dialogs).
    - `screens/subject-workspace/` — `SubjectWorkspaceScreen.tsx` & `SubjectQuizTab.tsx` (orchestrates subject metadata, materials tab, terms tab, and subject quiz tree).
    - `screens/material-workspace/` — `MaterialWorkspaceScreen.tsx` (composite material workspace: Read, Write, Quiz, Flashcards, and Manage tabs).
    - `screens/collection-workspace/` — `CollectionWorkspaceScreen.tsx` (playlist collection route (`/collections/:collectionId`): header with title/description/color/count, Library breadcrumbs, Edit/Delete actions, junction-ordered `MaterialCard` grid with per-card "Remove from Collection", empty state).    - `screens/explore/` — `ExploreScreen.tsx` (shares-only public study-package hub with 1-click cloning).
    - `screens/terms/` — `TermManagerScreen.tsx` (academic term manager and global usage counts).
    - `screens/quiz-session/` — `QuizSessionScreen.tsx` (live quiz runner route screen).
    - `screens/quiz-canvas/` — `QuizCanvasBuilderScreen.tsx` (thin composition wrapper hosting the quiz canvas subsystem).
    - `screens/analytics/` — `AnalyticsScreen.tsx` (learning insights and study metrics screen).
    - `screens/importer/` — `ImporterScreen.tsx` (5-step document import wizard screen).
    - `screens/shared-package/` — `SharedPackageScreen.tsx` (cloud package inspection and import screen).

- `layouts/` — Structural Frame & Page Containers:
  - `layouts/AppShell.tsx` — Thin composition root: wires `useAppRoute`, `useShellFocusMode`, `useFocusModeMotion` (GSAP rail layout animation), `AppHeader`, `AppSidebar`, `<ShellRoutes>`, and mounts transient overlays from `overlays/`.
  - `layouts/AppHeader.tsx` & `layouts/appHeader.stylex.ts` — Global Top Bar (`height: 52px`, `zIndex: 110`): renders brand identity (Logo, Project LunaClair, `v0.2.0` badge) on the left, and global actions/status (PWA install affordance, `SyncStatusPill`) on the right. Automatically morphs into floating glass capsules with icon-only presentation on scroll (`useHeaderScroll`) or when Focus Mode is active.
  - `layouts/useHeaderScroll.ts` — Throttled passive scroll depth tracker with hysteresis for header compaction.
  - `layouts/AppSidebar.tsx` — Viewport navigation router: delegates to `DesktopSidebar`, `TabletRail`, and `MobileBottomDock`.
  - `layouts/navigation/` — Viewport navigation slices:
    - `navigation/DesktopSidebar.tsx` & `navigation/DesktopTrapezoidButton.tsx` — 240px vertical sidebar with Option A $240\times58\text{px}$ rounded trapezoid drawer continuously morphing into the $44\times44\text{px}$ corner restore button.
    - `navigation/TabletRail.tsx` — 60px floating vertical icon rail with in-place link fade and vertical collapse into the $44\times44\text{px}$ corner card.
    - `navigation/MobileBottomDock.tsx` — 60px floating horizontal bottom dock with in-place link fade and horizontal contraction into the $44\times44\text{px}$ corner card.
    - `navigation/navigation.types.ts` — Shared viewport navigation types and active states.
    - `navigation/navItems.ts` — Shared nav-item registry (labels, icons, routes, active-path matching) consumed by all three viewport navigation slices.
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
- Focus Mode contract: `useShellFocusMode` owns `isFocusMode` (initialized from `localStorage`, persisted on every toggle) and `AppShell` passes `isFocusMode` + `onToggleFocusMode` to `AppSidebar`. `Cmd+B` (macOS) / `Ctrl+B` (Windows/Linux) toggles it from any page. On desktop, `useFocusModeMotion` collapses the rail to `width: 0` (so main content fills the full viewport) while keeping `opacity: 1` and applying `pointer-events: none` — the `DesktopSidebar` handles its own focus-mode visuals internally (fade links, transparent bg, morph trapezoid to a44×44 pill). The trapezoid button's `focusModeButton` style sets `pointer-events: auto` to remain clickable through the rail. On tablet/mobile, the rail stays visible and `FocusRestoreFAB` provides the exit affordance.
- Query hooks access domain repositories through DI context (`context.repositories.*`, ADR-011). Mutation hooks and domain workflows call `ApplicationContext.useCases.*` and never import concrete implementations directly. Shell-level bootstrap coordinates infrastructure via `context.infrastructure.*`.
- First-run onboarding contract: one-time per browser, skippable, rendered as a native `<dialog>`. Syncs default terms via `SyncDefaultTermsUseCase` on Finish AND Skip.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:run`

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/app/screens/AGENTS.md` | `src/app/screens/` | Application Screen & Route Composition Layer (ADR-014) |
