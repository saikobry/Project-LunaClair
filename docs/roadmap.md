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
