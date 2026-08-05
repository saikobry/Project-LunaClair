# src/app/ — Application Shell

## Purpose

Application-level orchestration: the root shell layout, configuration constants, and React providers. Owns the top-level rendering tree but contains no business logic.

## Ownership

- `layouts/AppShell.tsx` — Root layout shell that manages top-level navigation via `AppRoute` discriminated union (`library` | `terms` | `subject` | `workspace` | `quiz-canvas` | `quiz-session`). Subject routes carry `activeTab: 'materials' | 'quiz' | 'terms'` serialized as `?tab=`; the dedicated `quiz-canvas` route (`/materials/:materialId/builder[/:quizId]`) renders `QuizCanvasBuilder` (imported via the quiz-management barrel) full-height in `<main>`. Owns Focus Mode state (`isFocusMode`, persisted to `STORAGE_KEYS.settings.focusMode`), the global `Cmd/Ctrl+B` toggle shortcut, and the zero bottom-padding mobile rule. GSAP animates the rail's layout width (240/64 ↔ 0, breakpoint-aware, `clearProps` back to CSS on restore) and the fixed bottom-left floating logo restore button (scale 0.8 ↔ 1.0, alpha 0 ↔ 1, `transformOrigin: left bottom`). While Focus Mode is on, a resize listener in `useFocusModeMotion` re-applies an inline rail `width: 0` on every viewport resize (and `clearProps` otherwise), keeping GSAP and the CSS breakpoint media queries in lockstep so crossing breakpoints (e.g. mobile → desktop) never reserves a sidebar slot.
- `layouts/MaterialWorkspace.tsx` — Material workspace shell (Read / Quiz / Manage tab bar + Page shell) wrapping `ReaderScreen`, `QuizScreen`, and `QuizManagementScreen`. Consumes catalog hooks (`useMaterial`, `useSubject`, `useTerm`) through the catalog public contract.
- `layouts/AppSidebar/AppSidebar.tsx` — Global navigation rail (desktop sidebar, tablet rail, mobile bottom dock) with GSAP sliding active pill. Navigation links (Library, Terms, Subjects) pin to the top padding (no brand header — brand identity lives only in the bottom-left footer). The footer is a 2-row brand card: row 1 = logo + full `Project LunaClair` title (never truncated) + `v1.0` badge; row 2 = `Focus Mode (Cmd+B)` label + Focus icon; stripped of its own border/background on tablet so it sits cleanly inside the 60px rail. On mobile the footer is hidden, so a Focus icon button in the bottom dock is the Focus Mode entry point (touch devices have no `Cmd/Ctrl+B`). Focus Mode exit is animated with GSAP as a morph toward/away from the bottom-left corner (`scale 1 ↔ 0.05`, `transformOrigin: 'left bottom'`, alpha fade) replacing the old `display: none` toggle. Consumes `useSubject` / `useMaterial` via direct catalog hook imports (scoped app-shell exception to the feature barrel rule — see `src/features/AGENTS.md`).
- `bootstrap/` — Composition root: creates repositories, use cases, and the application graph.
- `bootstrap.ts` — Application initialization: calls `DatabaseInitializer.initialize()` (opens Dexie database, runs legacy localStorage migration, seeds demo data if empty)
- `config/constants.ts` — App-wide constants (app name, studio name)
- `providers/AppProviders.tsx` — Astryx `<Theme>`, TanStack `<QueryClientProvider>`, `<ApplicationProvider>` (dependency-injected repositories + application services), and `<ToastProvider>` for user action notifications
- `providers/ApplicationContext.ts` — React context definition exposing the application graph (`useCases` plus repositories during migration)
- `providers/ApplicationProvider.tsx` — React context provider supplying one stable application graph to all feature hooks
- `providers/FocusModeContext.tsx` — Cross-cutting Focus Mode context (`FocusModeProvider` + `useFocusMode`), provided by `AppShell` so deeply-nested toolbars (reader, quiz canvas) react to the mode without prop-drilling; React context flows through portals
- `index.ts` — Barrel export of public API

## Local Contracts

- High-level orchestration only. Business workflows belong in `src/application/`; domain rules belong in `src/domain/`.
- Providers are added only when cross-feature state sharing is needed.
- `bootstrap.ts` runs once at app startup (from `App.tsx` `useEffect`) — it initializes the database layer via `DatabaseInitializer`. No content registration needed (documents are static assets in `public/materials/`).
- `AppShell.tsx` owns route state via the `AppRoute` union (`library` | `terms` | `subject` | `workspace` | `quiz-canvas` | `quiz-session`). Document resolution is delegated to the reader feature's `useDocument` hook. Quiz entry points emit `QuizLaunchRequest` from Library and Reader screens. Quiz management navigates via `StudyMaterial`.
- Focus Mode contract: `AppShell` owns `isFocusMode` (initialized from `localStorage`, persisted on every toggle) and passes `isFocusMode` + `onToggleFocusMode` to `AppSidebar`. `Cmd+B` (macOS) / `Ctrl+B` (Windows/Linux) toggles it from any page. While active, the rail animates to 0 width (main spans 100% width), the mobile bottom dock morphs away and its bottom padding is removed, and a GSAP-animated floating logo button (`bottom: 16px`, `left: 16px`, `zIndex: 150`, `transformOrigin: 'left bottom'`) restores navigation — the sidebar and the FAB morph toward/away from the same bottom-left corner. The sidebar's 2-row brand footer card (logo, full title, version badge, Focus trigger) is the entry point in normal mode. The quiz canvas builder runs on the dedicated `quiz-canvas` route (URL-addressable, sidebar stays visible and collapsible, `onClose` returns to the material Manage tab). On mobile, the reader annotation toolbar and the quiz canvas card toolbar sit at `bottom: calc(84px + safe-area)` above the bottom nav; when Focus Mode hides the nav they transition down to `calc(16px + safe-area)` (0.35s) to use the freed vertical space. Both toolbars accept an optional `isFocusMode` prop that overrides `useFocusMode()` context.
- Query hooks may access repositories through DI during migration. Mutation hooks call `ApplicationContext.useCases` and never import concrete implementations directly.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has no sub-boundaries.
