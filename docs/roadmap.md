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
  - Decoupled document resolution, markdown content delivery, and figure preprocessing.
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
- ✅ **Phase 6.1 — Flashcards & Spaced Repetition**
  - Spaced-repetition flashcards derived dynamically from existing question bank via `questionToCard`, pure SM-2 scheduler (`review`, `isDue`), `FlashcardReviewRepository` with v5 IndexedDB schema (`flashcardReviews`), 3D flip card player, rating flow, and embedded Flashcards tab in `MaterialWorkspace`.

## Additional shipped capabilities (not separately phased)

These capabilities were delivered after the numbered Phase 6.1 milestone and are documented here without retroactively assigning them to the Flashcards phase:

- ✅ **Writer:** Lexical WYSIWYG study-material authoring with lossless Markdown transformations and local document-content persistence.
- ✅ **Catalog-first library:** D1-delivered catalog discovery, explicit material import/removal, authoritative per-material resolution, and read-only previews.
- ✅ **Application shell hardening:** Quiz canvas crash-recovery drafts, URL-addressable workspace routes, Focus Mode, and first-run onboarding.
- ✅ **Architecture enforcement:** ADR-010 direct-path feature contracts, feature ownership cleanup, and static import-boundary guardrails.

---

## Offline Readiness (Implemented — Aug 2026)

LunaClair is installable and offline-capable. Offline readiness is separate from cloud synchronization:

- ✅ **PWA foundation:** `vite-plugin-pwa` provides the app-shell service worker, web manifest, and generated install icons. Registration and manifest injection are handled by the build.
- ✅ **Content delivery caching:** canonical study materials live under `content/materials/`, are seeded into Cloudflare D1, served by the API Worker, and cached on demand by the service worker. Imported document markdown is persisted locally in Dexie's `documentContents` store.
- ✅ **Offline UX:** `OfflineBanner` communicates connectivity, and TanStack Query uses `networkMode: 'offlineFirst'` so IndexedDB-backed queries and mutations continue while disconnected.
- ✅ **Install discovery:** an opt-in sidebar install entry and a one-time iOS-specific install card are available without deferred `beforeinstallprompt` machinery.
- ✅ **First-run onboarding:** a bundled, skippable tutorial syncs the default academic terms into local state when dismissed or completed.

Offline-ready ≠ offline-sync: synchronization (sync queue, conflict resolution) stays **Phase 10 — Cloud Synchronization** scope.

---

## Planned Phases

- 🔒 **Phase 7 — Analytics & Learning Insights**
  - Performance dashboards, spaced repetition retention curves, mastery tracking across subjects.
- 🔒 **Phase 8 — AI Content Generation**
  - AI-generated question banks, automated material summaries, flashcard set generation.
- 🔒 **Phase 9 — Content Importer**
  - PDF importing, OCR text extraction, custom material import pipelines.
- 🔒 **Phase 10 — Cloud Synchronization**
  - Cloud database adapter, offline-first sync pipelines, multi-device state synchronization.
- 🔒 **Phase 11 — Collaboration & Sharing**
  - Shared question decks, peer study sessions, exported quiz bundles.
