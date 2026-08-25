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
- ✅ **Phase 6.2 — LunaClair Writer & Markdown Fidelity Stabilization**
  - Standard Lexical WYSIWYG authoring engine with lossless bidirectional Markdown transformations (headings H1–H6, paragraphs, inline styles, multi-level nested lists, GFM tables, images, blockquotes, horizontal rules).
  - Embedded `MaterialWriterTab` in `MaterialWorkspace` with Save/Discard/Copy/Export actions, active dirty state tracking, and unsaved material-switch modal protection.
  - Local document markdown persistence via Dexie's `documentContents` store (Dexie schema v6/v8) and `HybridDocumentRepository` fallback.
  - Three-layer testing suite: 76 Vitest tests (unit, transformer, fidelity, Dexie persistence, and UI state) + 10 Playwright real-browser E2E acceptance tests.
- ✅ **Phase 7 — Analytics & Learning Insights**
  - Pure domain analytics calculation engines operating deterministically on canonical learning data (`quizSessions` and `flashcardReviews`) with zero side effects.
  - Question-weighted accuracy (`totalCorrect / totalAnswered * 100`), consecutive streak with today/yesterday grace logic and historical max, mutually exclusive card maturity partition (`newCount + learningCount + reviewCount + masteredCount === totalCards`), and 7-day review forecast with overdue collapsing.
  - Topic and subject mastery matrices with difficulty multipliers ($1.0, 1.5, 2.0$), attempt counting, and deterministic strengths/weaknesses ranking ($\ge 85\%$, $\ge 3$ attempts).
  - Application orchestration: `AnalyticsRepository` port, `DexieAnalyticsRepository` using concurrent indexed queries (`Promise.all`), and application use cases (`GetGlobalAnalyticsUseCase`, `GetSubjectAnalyticsUseCase`, `GetMaterialAnalyticsUseCase`).
  - Presentation hub: `/analytics` screen (`Insights` in sidebar), 4 KPI overview cards, card maturity segmented distribution, lightweight SVG review forecast chart, subject mastery matrix, and 52-week activity heatmap with semantically honest labels.
  - Automatic cache invalidation on quiz session completion and flashcard reviews.
  - Comprehensive verification: 21 Vitest test files (138 tests, 100% passing) + 10 Playwright E2E tests.

## Additional shipped capabilities (not separately phased)

These capabilities were delivered alongside Phases 6.1/6.2/7 and are documented here:

- ✅ **Catalog-first library:** D1-delivered catalog discovery, explicit material import/removal, authoritative per-material resolution, and read-only previews.
- ✅ **Application shell hardening:** MiniToc responsive outline overlay with scroll-spy, Quiz canvas crash-recovery drafts, URL-addressable workspace routes, Focus Mode, and first-run onboarding.
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

- ✅ **Phase 8 — AI Study Assistant & Content Generation**
  - **8A (AI Infrastructure & Streaming):** Cloudflare Workers AI bridge (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), line-buffered SSE chunk streaming, provider-agnostic `AiService` port, `WorkerAiAdapter`, and `useAiStreamChat` token hook.
  - **8B (Grounded Context & Tutor Modes):** Section-aware context extractor (`extractSectionContext`), multi-mode prompts (`assistant`, `socratic`, `summarizer`), and active text selection contextual actions ("Explain", "Simplify", "Example").
  - **8C (Thread Persistence & Workspace Drawer):** Persistent conversation threads and messages in IndexedDB (Dexie v9 `aiThreads`/`aiMessages`, `DexieAiChatRepository`), orphan message cleanup, interrupted stream recovery, and workspace-level drawer integration (`MaterialWorkspace` → `AiChatDrawer`).
  - **8D (AI Content Synthesis — Questions & Flashcards):** Structured generation port (`generateStructured`) with single-pass JSON repair, canonical question schema validators across 5 quiz types, atomic batch persistence (`QuestionRepository.createQuestionsBatch`) in default `draft` status, interactive `AiQuestionGeneratorDialog` in Question Bank, and dedicated `AiFlashcardGeneratorDialog` with front/back flashcard cards in FlashcardScreen.

---

## Planned Phases

- 🔒 **Phase 9 — Content Importer**
  - PDF importing, OCR text extraction, custom material import pipelines.
- 🔒 **Phase 10 — Cloud Synchronization**
  - Cloud database adapter, offline-first sync pipelines, multi-device state synchronization.
- 🔒 **Phase 11 — Collaboration & Sharing**
  - Shared question decks, peer study sessions, exported quiz bundles.
