# src/features/flashcards/ — Spaced-Repetition Study & Flashcard Engine

## Purpose

Spaced-repetition study mode utilizing SuperMemo-2 (SM-2) retention scheduling. Owns card projection from questions, interactive 3D card flipping, rating dispatches, and review session completion.

## Ownership

| Path | Responsibility |
|---|---|
| `FlashcardScreen.tsx` | Feature-root screen orchestrator. Manages setup view, active deck progression, card flipping state, and session completion summary. |
| `components/` | Presentational views: `FlashcardDeckSetupView` (card count, due/new stats, quiz filter), `FlashcardPlayerView` (3D flip card, prompt/answer toggle, rating controls), `FlashcardSessionEndView` (performance summary & retention breakdown). |
| `hooks/mutations/` | Spaced-repetition mutations: `useFlashcardRating` (dispatches rating and updates cache). |
| `hooks/queries/` | Review data queries: `useFlashcardReviews`. |
| `queries/` | Query key factory (`flashcardQueryKeys.ts`). |
| `utils/` | Pure helpers: `deckCardStats.ts` (`collectDeckCardStats` — projects questions and derives the setup view's card counts, so the counts are computed outside the React component). |
| `types/` | Feature types: `flashcardFeature.types.ts`. |

## Local Contracts

- **Feature-Root Screen Orchestrator**: `FlashcardScreen.tsx` sits at the feature root as the primary route-level screen for spaced repetition study.
- **Card Projection Invariant**:
  - Flashcard decks are dynamic projections generated from Question entities (`questionToCards` domain transformation). **Cardinality is 1..N per question, not 1:1**: every non-cloze type yields exactly one card, while a `fill_in_blank` question yields one card per blank so each blank gets its own SM-2 schedule.
  - Cards are discriminated by **shape**, not by question type: `kind: 'recall'` (from `identification`, `true_false`, and any `fill_in_blank` row with no per-blank expansion available) fronts a bare prompt, while `kind: 'choice'` (from `multiple_choice`, `multiple_select`) fronts the prompt *and* its options. The projection carries no `QuestionType` — a `multiple_choice` card with its options dropped would be a choice card with nothing to choose between.
  - Front-face contract, by shape:
    - `recall` (non-cloze) — the question's own prompt; the back is the rendered answer.
    - `choice` — the prompt plus every option, ungraded; correctness is marked only on the back face.
    - per-blank `recall` (cloze) — the resolved template with the **target** blank left as `___` and **every other** blank replaced by its answer, so the tested blank is the only thing missing; the back is that single answer, never the joined list. Anki cloze behaviour: the other answers are retrieval context and scaffolding.
  - Cards represent question prompts (front) and explanations/answers (back).
  - `cardKey.ts` (`domain/flashcards/engines/`) is the only place card keys are built, and it owns both formats: `cardKeyForQuestion` → `q:${questionId}` (unchanged for every non-cloze card, so persisted review state keeps resolving) and `cardKeyForBlank` → `q:${questionId}#${blankIndex}`. Card keys are persisted review-state keys, so the formats must stay byte-identical.
  - `orderDeck` takes **already-projected cards**, not questions, so the caller owns card order: a fill_in_blank question's per-blank cards inherit that question's slot in the incoming order.
  - Every count the setup view shows is a **card** count (`dueCount`, `newCount`, total, and the per-quiz filter counts), because counting questions would make "Due Cards Only" promise fewer cards than the session actually shows. Per-quiz filter counts sum the projected cards of that quiz's questions. `collectDeckCardStats` (`utils/deckCardStats.ts`) is the single place those counts are derived, so no presentation code can reintroduce a question count.
  - **Legacy-key consequence:** a `fill_in_blank` question's key moved from `q:${questionId}` to `q:${questionId}#0` when per-blank cards landed, so review state stored under the old whole-question key is no longer read. The project is pre-release, so nothing is owed: no migration, no orphan cleanup, and pre-existing local rows are disposable via the database reload path. Were there real usage, the restoration is a lookup fallback.
  - When a quiz filter is selected, cards follow that quiz's `items[].order`; the question repository's arbitrary read order is not the deck contract. That incoming order is authoritative only for cards with no review history — `orderDeck` re-buckets reviewed cards by `dueAt`, so SM-2 scheduling supersedes authoring order after the first pass (pinned by `domain/flashcards/engines/__tests__/deck.test.ts`).
  - No glossary-term flashcards exist unless explicitly introduced via a future ADR.
- **Review State & SM-2 Invariants**:
  - Review state (`repetitions`, `easeFactor`, `intervalDays`, `dueAt`, `lapses`, `reviewCount`) belongs strictly to the domain `FlashcardReview` entity.
  - SM-2 scheduling calculations are performed by the pure domain `scheduler`.
- **Rating Dispatch & Cache Invalidation**:
  - Rating submissions (`again`, `hard`, `good`, `easy`) route exclusively through `RecordFlashcardReviewUseCase`.
  - `useFlashcardRating` applies optimistic updates to `flashcardQueryKeys.reviews(materialId)` and invalidates `analyticsQueryKeys.all()` to keep mastery charts synchronized.
- **Interactive Player Lifecycle**:
  - Setup: Displays card count, new cards count, and due cards count with a start trigger.
  - Player: Card renders front by default. User triggers flip (keyboard Space/Enter or click) to reveal answer and enable 4 rating options.
  - Completion: Summarizes session accuracy, count of cards reviewed, and returns to workspace.
- **Player Presentation Contract**:
  - A `recall` card shows no shape badge: the source question type is no longer on the card, and a badge naming the card's own shape is noise.
  - A `choice` card renders its options on the **front** face (they are part of the question) with no grading marks; which options are correct is marked only on the **back** face, after the flip. Nothing on the front face may hint at correctness.
  - The difficulty badge is worded as the *source question's* authored difficulty (`Source difficulty: …`) — SM-2 never measures a card's difficulty, so the badge must not claim one.
  - Card kind changes presentation only. Flip mechanics, keyboard activation, the `key={card.key}` remount, the rating bar, and the progress indicator are kind-agnostic.
  - **Bounded scroll region = the flip control** (`FlashcardPlayerView.tsx`). Each face's content area is a scrollable region (`overflowY: auto`, `minHeight: 0`, `margin: auto`-centred content so a tall card never clips its start) and that region *is* the flip control (`role="button"`, accessible name `Show answer` / `Show question`, `tabIndex`). The wrapper is a plain non-interactive 3D container by design: an interactive ancestor must not contain another focusable control (`react-doctor/html-no-nested-interactive`), and the card's whole-content button could not hold a separately focusable region. Only the active face is in the tab order (`tabIndex` 0 / -1) and accepts pointer input (`pointerEvents` toggled per face, because a backface-hidden face is still hit-tested in some engines); Space/Enter are claimed for the flip, so the region scrolls with the browser-native Arrow / Page Up / Page Down keys. Each face's `flipHint` lives **inside** that region, so its "Click to reveal" instruction is inside the click surface it describes.
  - The rating bar is rendered **outside** the per-face scroll region, so long answers can never scroll the four ratings out of reach — a learner can always rate.
- **Direct-Path Consumption (ADR-010)**:
  - Outside consumers import direct paths (e.g. `flashcards/FlashcardScreen`, `flashcards/queries/flashcardQueryKeys`). No root barrel is exposed.

## Work Guidance

- Colocate all unit/component/hook tests in `__tests__/` alongside the tested unit (ADR-012).
- Never calculate SM-2 schedules or mutate review records in UI components; always dispatch through `RecordFlashcardReviewUseCase`.

## Verification

- `npm run test:run` — Runs all flashcard screen, rating mutation, and player tests.
- `npm run lint` — Validates Oxlint boundary guardrails.
- `npm run build` — Validates TypeScript and production bundling.
