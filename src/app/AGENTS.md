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
  - `routing/routing.ts` — `AppRoute` union types, URL path parser (`urlToRoute`), and URL serializers (`routeToUrl`). Includes the Unfiled route (`/unfiled`, unassigned materials via `LibraryHomeScreen` unfiled mode).
  - `routing/useAppRoute.ts` — `useAppRoute` hook: parses URL on mount, syncs URL on navigation via `pushState`, and tracks `popstate` history.  - `routing/ShellRoutes.tsx` — Per-route screen switcher table: conditionally renders route screens (Library / Unfiled / Explore / Analytics / MaterialWorkspace / Collection / QuizCanvasBuilder / QuizScreen) with `lazy()` and `<Suspense>` boundaries.

- `screens/` — Application Screen & Route Composition Layer (ADR-014):
  - Route-level screens and cross-feature orchestrations:
    - `screens/library/` — `LibraryHomeScreen.tsx` & `LibraryModals.tsx` (material creation/edit dialogs + collection assignment dialogs).
    - `screens/material-workspace/` — `MaterialWorkspaceScreen.tsx` (composite material workspace: Read, Write, Quiz, Flashcards, and Manage tabs).
    - `screens/collection-workspace/` — `CollectionWorkspaceScreen.tsx` (playlist collection route (`/collections/:collectionId`): `CollectionHero` with inline-editable title/description, stats, and Quick Study; Library breadcrumbs, `EditCollectionModal` wired to `useUpdateCollection`, `ConfirmationDialog` delete wired to `useDeleteCollection` + Library return, Materials tab (junction-ordered `MaterialCard` grid with per-card "Remove from Collection") and Quizzes tab (`CollectionQuizExplorer` with unified-quiz `onStartQuiz`), empty state).    - `screens/explore/` — `ExploreScreen.tsx` (shares-only public study-package hub with 1-click cloning).
    - `screens/quiz-session/` — `QuizSessionScreen.tsx` (live quiz runner route screen).
    - `screens/quiz-canvas/` — `QuizCanvasBuilderScreen.tsx` (thin composition wrapper hosting the quiz canvas subsystem).
    - `screens/analytics/` — `AnalyticsScreen.tsx` (learning insights and study metrics screen).
    - `screens/importer/` — `ImporterScreen.tsx` (5-step document import wizard screen).
    - `screens/shared-package/` — `SharedPackageScreen.tsx` (cloud package inspection and import screen).

- `layouts/` — Structural Frame & Page Containers:
  - `layouts/AppShell.tsx` — Thin composition root: wires `useAppRoute`, `useShellFocusMode`, `useFocusModeMotion` (GSAP rail layout animation), `AppHeader`, `AppSidebar`, `<ShellRoutes>`, and mounts transient overlays from `overlays/`.
  - `layouts/AppHeader.tsx` & `layouts/appHeader.stylex.ts` — Global Top Bar (`height: 52px`, `zIndex: 110`): renders brand identity (Logo, Project LunaClair, `v0.2.0` badge) on the left, and global actions/status (PWA install affordance, `SyncStatusPill`) on the right. Automatically morphs into floating glass capsules with icon-only presentation on scroll (`useHeaderScroll`) or when Focus Mode is active.
  - `layouts/useHeaderScroll.ts` — Throttled passive scroll depth tracker with hysteresis for header compaction.
  - `layouts/AppSidebar.tsx` — Viewport navigation router: threads `collectionId`, active section, and Focus Mode state, delegating to `DesktopSidebar`, `TabletRail`, and `MobileBottomDock`.
  - `layouts/navigation/` — Viewport navigation slices:
    - `navigation/DesktopSidebar.tsx` & `navigation/DesktopTrapezoidButton.tsx` — 240px vertical sidebar with Option A $240\times58\text{px}$ rounded trapezoid drawer continuously morphing into the $44\times44\text{px}$ corner restore button. Owns the dynamic Collections section (`CollectionsNav`: `useCollections` list with `getCollectionIcon` icons + color styling, per-collection material count badges via `useCollectionMaterialCounts`, active state via `collectionId`, quick-add `CreateCollectionModal` that navigates to the new collection on save) in an independent scroll pane that keeps the primary links and trapezoid footer pinned, and the Unfiled primary item's live unassigned count badge (via `useUnassignedMaterials`).
    - `navigation/TabletRail.tsx` — 60px floating vertical icon rail with in-place link fade and vertical collapse into the $44\times44\text{px}$ corner card. Hosts primary navigation items, a `CompactCollectionsPopover` for collections discovery, and the Focus Mode restore trigger.
    - `navigation/MobileBottomDock.tsx` — 60px floating horizontal bottom dock with in-place link fade and horizontal contraction into the $44\times44\text{px}$ corner card. Hosts primary navigation items, a `CompactCollectionsPopover` for collections discovery, and the Focus Mode restore trigger.
    - `navigation/CompactCollectionsPopover.tsx` — Compact collections discovery orchestrator: owns the trigger, open state, anchored-panel geometry (`computePosition`, an Effect Event so it does not resubscribe the dismissal effects), body scroll locking for the dock placement, cross-breakpoint auto-dismissal, and `CreateCollectionModal` wiring. Both surfaces render through a portal so they escape the rail/dock `overflow: hidden` + transformed containers.
    - `navigation/CompactCollectionsPanel.tsx` — The two compact collections surfaces, providing instant playlist switching, count badges, and New Collection creation. `CompactCollectionsDockDrawer` (mobile, `placement="dock"`) is a **native modal `<dialog>`** opened with `showModal()` — focus trapping, Escape, `::backdrop`, and top-layer stacking come from the platform — and keeps the drag-to-dismiss gesture and touch-friendly rows. `CompactCollectionsRailPanel` (tablet, `placement="rail"`) is the anchored side popover with dynamic boundary clamping and height recalculation for lower rail positions. Breakpoint crossing (mobile dock ↔ tablet rail ↔ desktop sidebar) auto-dismisses either surface. The dock drawer's style block keeps the pre-dialog border box (1px top/left/right) and overrides the UA dialog defaults so its geometry is unchanged.
    - `navigation/compactCollectionsPopover.stylex.ts` — StyleX rules for the trigger and both compact collections surfaces (including the dock drawer's native-dialog resets and `::backdrop`).
    - `navigation/navigation.types.ts` — Shared viewport navigation types, active states, and `MaterialWorkspaceTab`.
    - `navigation/navItems.ts` — Shared nav-item registry (labels, icons, routes, active-path matching) consumed by all three viewport navigation slices. Includes the Unfiled entry (`{ kind: 'unfiled' }`, active on the `unfiled` section).
  - `layouts/useShellFocusMode.ts` — Focus Mode state hook (`STORAGE_KEYS.settings.focusMode`, `Cmd/Ctrl+B` toggle).

- `overlays/` — Transient System UI (Out of Document Flow):
  - `overlays/OfflineBanner.tsx` — Global connectivity status indicator (`zIndex: 200`). Draggable, auto-collapsing offline pill with magnetic screen border snapping.
  - `overlays/OnboardingTutorial.tsx` — First-run welcome tutorial full-screen takeover rendered as a native `<dialog>` (`showModal()`).
  - `overlays/InstallPrompt.tsx` — PWA install surfaces: one-time iOS install card (`InstallPrompt`) and platform-aware instructions dialog (`InstallInstructionsDialog`).
  - `overlays/installDetection.ts` — Pure PWA detection helpers: `isIOS()` and `isStandalone()`.

## Local Contracts

- High-level orchestration only. Business workflows belong in `src/application/`; domain rules belong in `src/domain/`.
- Providers are added only when cross-feature state sharing is needed.
- `bootstrap.ts` runs once at app startup (from `App.tsx` `useEffect`) — it initializes the database layer via `DatabaseInitializer`. No auto-hydration: the catalog is fetched independently when the Available UI requires it, and materials are imported on user action.
- `AppShell.tsx` mounts `OfflineBanner` as global chrome. TanStack Query's `networkMode: 'offlineFirst'` default for queries and mutations (set in `providers/AppProviders.tsx`) is a hard requirement for offline operation.
- Route state lives in `useAppRoute` via the `AppRoute` union. Navigation helpers live in `src/app/routing/routing.ts`. The shell maps the `unfiled` route to the `unfiled` nav section (`getShellRouteContext`).
- Focus Mode contract: `useShellFocusMode` owns `isFocusMode` (initialized from `localStorage`, persisted on every toggle) and `AppShell` passes `isFocusMode` + `onToggleFocusMode` to `AppSidebar`. `Cmd+B` (macOS) / `Ctrl+B` (Windows/Linux) toggles it from any page. On desktop, `useFocusModeMotion` collapses the rail to `width: 0` (so main content fills the full viewport) while keeping `opacity: 1` and applying `pointer-events: none` — the `DesktopSidebar` handles its own focus-mode visuals internally (fade links, transparent bg, morph trapezoid to a44×44 pill). The trapezoid button's `focusModeButton` style sets `pointer-events: auto` to remain clickable through the rail. On tablet/mobile, the rail stays visible and `FocusRestoreFAB` provides the exit affordance.
- Query hooks access domain repositories through DI context (`context.repositories.*`, ADR-011). Mutation hooks and domain workflows call `ApplicationContext.useCases.*` and never import concrete implementations directly. Shell-level bootstrap coordinates infrastructure via `context.infrastructure.*`.
- First-run onboarding contract: one-time per browser, skippable, rendered as a native `<dialog>`.

## Verification

- `npm run build`
- `npm run lint`
- `npm run test:run`

## Child DOX Index

| Child | Scope | Purpose |
|---|---|---|
| `src/app/screens/AGENTS.md` | `src/app/screens/` | Application Screen & Route Composition Layer (ADR-014) |
