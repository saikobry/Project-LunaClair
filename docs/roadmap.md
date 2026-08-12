# LunaClair Roadmap

**Studio:** Saiko Interactive  
**Project:** LunaClair — Interactive AI Learning Platform  

---

## Completed Phases

- ✅ **Phase 1 — Foundation & Application Architecture**
  - Application shell layout, StyleX design tokens, React 19 + TypeScript + Vite setup.
- ✅ **Phase 2 — Repository & Dependency Injection**
  - Domain-level repository ports, React Context dependency injection (`RepositoryProvider`), and TanStack Query integration.
- ✅ **Phase 3 — Reader Domain Modernization**
  - Highlight and drawing persistence, per-document annotation keying, optimistic mutation hooks.
- ✅ **Phase 4 — Content Asset Pipeline**
  - Decoupled document resolution from `AppShell`, static markdown content fetching (`public/materials/`), markdown figure preprocessing.
- ✅ **Phase 4.1 — Reader Architecture Cleanup**
  - Removal of legacy in-memory content registries and standardization of storage namespaces.
- ✅ **Phase 5 — Assessment Engine Foundation**
  - Dexie IndexedDB database (`lunaclair-db`), strategy-based answer grading (`QuestionStrategyResolver`), pure `AssessmentService`, immutable `questionSnapshots` in `QuizSession`, multi-question type support (`multiple_choice`, `multiple_select`, `true_false`, `identification`, `fill_in_blank`), and centralized `QuestionRenderer`.
- ✅ **Phase 5.1 — Assessment Experience Integration**
  - Lightweight `AppRoute` navigation, "Start Quiz" entry points in Library and Reader screens, `QuizScreen` state machine, interactive `QuizView` player, post-session `QuizResultView`, modular session sub-hooks, and atomic session persistence.
- ✅ **Phase 5.2 — Quiz & Question Management**
  - Dedicated authoring feature module (`src/features/quiz-management/`), full-screen management interface (`QuizManagementScreen`), Question Bank tab, Quiz Catalog tab, dynamic `QuestionEditorRegistry` for 5 question types, `QuizBuilderDialog` with version pinning, publishing status workflows (`draft` / `published` / `archived`), and soft-deletion archiving.
- ✅ **Phase 6 — Application Layer & Domain Boundary Refinement**
  - Added framework-agnostic application use cases, a composition root, direct use-case mutation adapters, atomic quiz session submission, and application-owned material/subject-term validation.

---

## Offline Readiness (Implemented — Aug 2026)

The delivery layer previously had zero PWA infrastructure (audit: no service worker, no manifest, no content caching, no offline UI). All four gaps are now closed:

- ✅ **Phase A — PWA foundation:** `vite-plugin-pwa` (v1.3, Vite 8-compatible). Service worker precaches the app shell — 47 entries ≈ 7.4 MB first install. Web manifest (`display: standalone`, white theme/background, portrait) + PNG icon set (`pwa-64/192/512`, `maskable-icon-512`, `apple-touch-icon-180`) generated from `public/app-icon.svg` (a square, white-background derivation of `favicon.svg`; `icons.svg` is a social sprite and was never usable). Regenerate with `npm run generate:pwa-assets`. SW registration + manifest link are auto-injected at build.
- ✅ **Phase B — Content caching:** precache glob `materials/**` covers documents and figure images. The SW answers `LocalDocumentRepository` fetches with zero repository changes (Dexie = app data, Cache Storage = delivery).
- ✅ **Offline UX:** `OfflineBanner` in the app shell (persistent "You're offline" warning chip + transient "You're back online" recovery chip; `aria-live`). Plus one hidden prerequisite: TanStack Query now runs `networkMode: 'offlineFirst'` — the default `'online'` mode pauses not-yet-cached queries when offline, which surfaced as "Material not found" on fresh material lookups.
- ✅ **Install discovery (community-reviewed):** quiet opt-in `Install app` / `Add to Home Screen` sidebar entry + a one-time **iOS-only** card shown from the second distinct visit (dismissed forever, hidden when installed and in dev). Deliberately no `beforeinstallprompt`/deferred-prompt machinery — Chromium already surfaces install natively; iOS had zero native path (see `src/app/AGENTS.md`).

**Asset audit:** `public/materials/` = 28 files, **6.1 MB** (7 markdown ≈ 40 KB + 21 PNG figures, all under `anatomy-physiology/images/`). **Precache everything** is the right call at this size; switch to a `/materials/**` runtime cache if content grows. Verified: offline cold boot from cache, library from IndexedDB, documents render with all 22 anatomy figures served by the SW.

Offline-ready ≠ offline-sync: synchronization (sync queue, conflict resolution) stays **Phase 9 — Cloud Synchronization** scope.

---

## Planned Phases

- 🔒 **Phase 6 — Flashcards & Spaced Repetition**
  - Flashcard domain entities, Leitner / SM-2 spaced repetition scheduler, review session history.
- 🔒 **Phase 7 — AI Content Generation**
  - AI-generated question banks, automated material summaries, flashcard set generation.
- 🔒 **Phase 8 — Content Importer**
  - PDF importing, OCR text extraction, custom material import pipelines.
- 🔒 **Phase 9 — Cloud Synchronization**
  - Cloud database adapter, offline-first sync pipelines, multi-device state synchronization.
- 🔒 **Phase 10 — Search & Discovery**
  - Full-text material search, tag/difficulty indexes, assessment discovery engine.
