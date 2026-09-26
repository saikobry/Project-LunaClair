# LunaClair — Flashcards & Spaced Repetition Implementation Plan

**Status:** Implemented — Phase 6.1 (Flashcards & Spaced Repetition)
**Decisions locked:** Cards derive from quiz questions · SM-2 scheduler · per-card review state persisted in IndexedDB
**Owner:** Saiko Interactive

---

## 1. Goal & Scope

A **flashcards** study mode that derives cards from the existing question bank and schedules them with an SM-2 spaced-repetition algorithm, persisting per-card review state locally (offline-first, mirroring the app's Phase 5–6 patterns).

**In scope**
- Pure domain layer: `Flashcard` mapping from `Question`, SM-2 scheduler, review-state model, repository contract.
- v5 Dexie migration: `flashcardReviews` store.
- Feature module `src/features/flashcards/`: deck builder, flip-card player, rating flow, due-today view.
- Entry point: a **Flashcards tab** in `MaterialWorkspace` (embedded, like the Quiz tab).

**Out of scope (deferred)**
- Cards from glossary `Term`s (needs a `definition` field + migration) — the domain key scheme (`q:` / `t:` prefixes) leaves room for it.
- Session history/stats tables (`quizSessions`-style) — v1 persists per-card state only.
- AI-generated decks (Phase 8 generator) and content import (Phase 9 importer).
- Cloud sync of review state (Phase 10).

## 2. Why this fits the codebase

Everything needed already exists in some form:

| Need | Existing asset |
|---|---|
| Card content (prompt + answer + explanation) | `Question` (`prompt`, `payload`, `explanation`, `tags`, `difficulty`) |
| Per-type answer rendering | `AnswerPayload` discriminated union (5 types) |
| Multi-quiz deck assembly | `buildUnifiedQuestionSetFromQuizzes` in `domain/quiz/virtualQuiz.ts` |
| Session flow pattern | `useQuizSessionFlow` + `QuizSessionRepository` lifecycle |
| Offline persistence + migrations | Dexie versioned schema (currently v8) + `DatabaseMigrator` |
| Embedded feature screen | `QuizScreen` `embedded` mode inside `MaterialWorkspace` tabs |
| Pure domain services | `AssessmentService` (framework-free grading) |

No new authoring UI is needed — decks come from the question bank.

## 3. Domain Layer — `src/domain/flashcards/`

New domain module (domain may import from other domains, never from React, features, or infrastructure).

### 3.1 `Card.ts`

```ts
export type FlashcardSource = { type: 'question'; questionId: string };
export type FlashcardChoice = { label: string; correct: boolean };

export interface FlashcardBase {
  key: string;        // `q:${questionId}` — built only by `cardKeyForQuestion`
  source: FlashcardSource;
  front: string;      // semantic prompt / template text
  back: string;       // rendered correct answer(s)
  explanation?: string;
  materialId: string;
  tags?: string[];
  difficulty: 'easy' | 'medium' | 'hard';  // the source question's authored difficulty
}

export interface RecallCard extends FlashcardBase { kind: 'recall' }
export interface ChoiceCard extends FlashcardBase { kind: 'choice'; choices: FlashcardChoice[] }

export type Flashcard = RecallCard | ChoiceCard;
```

`kind` discriminates the card's **shape**, not the source question type. A `multiple_choice` question whose options were dropped would still be a choice card — just an incoherent one — so the projection deliberately does not carry a `QuestionType`.

### 3.2 `questionToCard.ts` — payload → card mapping (pure transient projection)

`questionToCard(question: Question): Flashcard` — pure function. `Flashcard` is a transient derived projection (never persisted to IndexedDB).

| Question type | Front content | Back content |
|---|---|---|
| `multiple_choice` | `question.prompt` | Correct choice text |
| `multiple_select` | `question.prompt` | Correct selections joined by comma |
| `true_false` | `question.prompt` | `True` / `False` |
| `identification` | `question.prompt` | `correctAnswer` (+ `acceptedAlternatives`) |
| `fill_in_blank` | `template` (or `prompt + "\n\n" + template`) | `blanks` joined by comma |

### 3.2.1 Player Presentation Contract
- `recall` cards: no shape badge. The source question type is not on the card, and a badge naming the card's own shape is noise.
- `choice` cards: the options are part of the question, so they are rendered on the **front** face, ungraded. Which options are correct is marked only on the **back** face, after the flip — nothing on the front face hints at correctness. A `multiple_select` question may have several correct options, hence the per-choice `correct` boolean.
- The `difficulty` badge is worded as the **source question's** authored difficulty (`Source difficulty: …`); SM-2 never measures a card's difficulty.


### 3.3 `scheduler.ts` — SM-2 (pure, testable)

State per card:

```ts
export interface ReviewState {
  key: string;
  repetitions: number;      // n (consecutive successes)
  easeFactor: number;       // EF, starts 2.5, floor 1.3
  intervalDays: number;     // I, starts 0
  dueAt: string;            // ISO; past = due now
  lapses: number;           // total failures
  lastReviewedAt?: string;
  reviewCount: number;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';
```

`review(card: ReviewState, rating: Rating, now: Date): ReviewState` — the full SM-2 update, implemented as one pure function so **FSRS can later replace the math without touching UI or storage**:

- Rating → quality: again=1, hard=3, good=4, easy=5.
- Correct (q ≥ 3): `repetitions += 1`; interval = 1 (first), 6 (second), else `round(I * EF)`.
- Incorrect (again): `repetitions = 0`, `intervalDays = 1`, `lapses += 1`.
- `EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))`, clamped ≥ 1.3.
- `dueAt = now + intervalDays` days.

`isDue(state, now): boolean` helper. New cards (no state) are always due.

### 3.4 `deck.ts` — deck assembly (pure)

```ts
orderDeck(questions: Question[], reviews: Record<string, ReviewState>, now: Date): Flashcard[]
```
- Map questions via `questionToCard`, then order: due cards first (oldest `dueAt`), new cards next, then non-due scheduled cards. Stable within groups.
- Filters (tags / difficulty / selected quizIds) applied by the caller before ordering.

### 3.5 `FlashcardReviewRepository.ts` — port (mirrors `QuizSessionRepository`)

```ts
export interface FlashcardReviewRepository {
  getByKeys(keys: string[]): Promise<ReviewState[]>;
  getByMaterial(materialId: string): Promise<ReviewState[]>;
  save(reviews: ReviewState[]): Promise<void>;   // upsert — one rating = one call
  deleteByKeys(keys: string[]): Promise<void>;
}
```

## 4. Infrastructure — v5 migration + repository

- `schema.ts`: add `SCHEMA_V5 = { ...SCHEMA_V4, flashcardReviews: 'key, materialId, dueAt, lastReviewedAt' }`; bump `DB_VERSION` to 5.
- `LunaClairDatabase.ts`: `version(5).stores(SCHEMA_V5)` + `flashcardReviews!: Table<ReviewState, string>` (review state carries its own key; no per-row wrapper needed).
- `src/infrastructure/database/repositories/DexieFlashcardReviewRepository.ts` implements the port.
- Register in `src/app/bootstrap/createRepositories.ts`; wire optional use cases in `createUseCases.ts`.

## 5. Application Layer

`RecordFlashcardReviewUseCase` owns the SM-2 review transition and persistence coordination. The feature mutation hook delegates to this use case, while query hooks read review state through the injected repository contract.

## 6. Feature Module — `src/features/flashcards/`

Implemented feature module (ADR-010 direct-path contracts; feature-root barrels are prohibited).

```
src/features/flashcards/
  FlashcardScreen.tsx            # orchestrator (mirrors QuizScreen, embedded-capable)
  types/flashcardFeature.types.ts
  hooks/
    queries/useFlashcardReviews.ts      # material-scoped review states
    mutations/useFlashcardRating.ts     # optimistic ReviewState upsert
  components/
    FlashcardDeckSetupView.tsx   # deck source (all quizzes / pick quiz / tag filter) + Start
    FlashcardPlayerView.tsx      # card stack, flip, rating bar, progress, keyboard
    FlashcardSessionEndView.tsx  # reviewed count, accuracy, "restudy missed", "done"
```

**Player UX**
- 3D flip card (rotateY + backface-visibility; Stylex + existing tokens), Space/Enter = flip.
- Rating bar after flip: **Again / Hard / Good / Easy** → SM-2 qualities 1/3/4/5. Keys 1–4.
- Deck order uses `orderDeck` (due-first) so each run surfaces overdue cards.
- Progress header: position, answered, "N due today" pill.
- Rating persists immediately (optimistic → Dexie upsert) so an interrupted run never loses state.

**Query keys:** new feature-owned factory `flashcardQueryKeys` (e.g. `['flashcards', 'reviews', materialId]`), mirroring `assessmentQueryKeys`/`catalogQueryKeys`.

## 7. App Wiring — entry point

- `MaterialWorkspace`: extend `MaterialTab` with `'flashcards'` (Read / Quiz / Flashcards / Manage); mount `FlashcardScreen` embedded — **no new route kind needed for v1** (mirrors embedded `QuizScreen`).
- `routing.ts`: `activeTab` union already flows through the query param; extend the workspace tab type + URL parsing cast.
- **Deferred:** sidebar "Flashcards (due)" entry and an immersive `/flashcards` route — only once there are global (cross-material) decks or due-today dashboards.
- Secondary entry (later phase): "Study missed questions as flashcards" from `QuizResultView` (reuses the existing `review` mode concept).

## 8. End-to-End Data Flow

```text
Flashcards tab → useQuestions(materialId) + useFlashcardReviews(materialId)
              → orderDeck(questions, reviews) → player
flip → rating → optimistic ReviewState → mutation hook → FlashcardReviewRepository → Dexie
deck finished → session-end summary; due dates now drive the next run's order
```

## 9. Build Order & Verification

| Step | Work | Gate |
|---|---|---|
| 1 | Domain: `Card`, `questionToCard`, `scheduler`, `deck`, repository port | `npm run build` |
| 2 | v5 migration + `DexieFlashcardReviewRepository` + bootstrap registration | `npm run build` + `npm run lint` |
| 3 | Feature: hooks, views, screen | `npm run build` + `npm run lint` + `npx react-doctor@latest --verbose --scope changed` |
| 4 | Wiring: workspace tab, routing type; **DOX pass** | `npm run build` + `npm run lint`; update `src/features/AGENTS.md` ownership table, `domain/AGENTS.md`, `infrastructure/AGENTS.md`, `app/AGENTS.md`, `docs/architecture/architecture.md`, roadmap |

## 10. Open Questions / Notes

- SM-2 quality mapping (1/3/4/5) matches Anki's 4-button feel; adjust to 2-button (Again/Good) if the product wants minimalism.
- Review-state table can later grow stats columns (per-day history) or a `flashcardSessions` history table — both are additive Dexie migrations.
- The `generator/` (AI decks) and `importer/` features are reserved and can reuse the same domain + player once built.
