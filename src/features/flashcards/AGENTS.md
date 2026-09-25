# src/features/flashcards/ — Spaced-Repetition Study & Flashcard Engine

## Purpose

Spaced-repetition study mode utilizing SuperMemo-2 (SM-2) retention scheduling. Owns card projection from questions, interactive 3D card flipping, rating dispatches, and review session completion.

## Ownership

| Path | Responsibility |
|---|---|
| `FlashcardScreen.tsx` | Feature-root screen orchestrator. Manages setup view, active deck progression, card flipping state, and session completion summary. |
| `components/` | Presentational views: `FlashcardDeckSetupView` (deck size & due stats), `FlashcardPlayerView` (3D flip card, prompt/answer toggle, rating controls), `FlashcardSessionEndView` (performance summary & retention breakdown). |
| `hooks/mutations/` | Spaced-repetition mutations: `useFlashcardRating` (dispatches rating and updates cache). |
| `hooks/queries/` | Review data queries: `useFlashcardReviews`. |
| `queries/` | Query key factory (`flashcardQueryKeys.ts`). |
| `types/` | Feature types: `flashcardFeature.types.ts`. |

## Local Contracts

- **Feature-Root Screen Orchestrator**: `FlashcardScreen.tsx` sits at the feature root as the primary route-level screen for spaced repetition study.
- **Card Projection Invariant**:
  - Flashcard decks are dynamic projections generated from Question entities (`questionToCard` domain transformation).
  - Cards represent question prompts (front) and explanations/answers (back).
  - When a quiz filter is selected, cards follow that quiz's `items[].order`; the question repository's arbitrary read order is not the deck contract.
  - No glossary-term flashcards exist unless explicitly introduced via a future ADR.
- **Review State & SM-2 Invariants**:
  - Review state (`repetitions`, `easeFactor`, `intervalDays`, `dueAt`, `lapses`, `reviewCount`) belongs strictly to the domain `FlashcardReview` entity.
  - SM-2 scheduling calculations are performed by the pure domain `scheduler`.
- **Rating Dispatch & Cache Invalidation**:
  - Rating submissions (`again`, `hard`, `good`, `easy`) route exclusively through `RecordFlashcardReviewUseCase`.
  - `useFlashcardRating` applies optimistic updates to `flashcardQueryKeys.reviews(materialId)` and invalidates `analyticsQueryKeys.all()` to keep mastery charts synchronized.
- **Interactive Player Lifecycle**:
  - Setup: Displays deck size, new cards count, and due cards count with a start trigger.
  - Player: Card renders front by default. User triggers flip (keyboard Space/Enter or click) to reveal answer and enable 4 rating options.
  - Completion: Summarizes session accuracy, count of cards reviewed, and returns to workspace.
- **Direct-Path Consumption (ADR-010)**:
  - Outside consumers import direct paths (e.g. `flashcards/FlashcardScreen`, `flashcards/queries/flashcardQueryKeys`). No root barrel is exposed.

## Work Guidance

- Colocate all unit/component/hook tests in `__tests__/` alongside the tested unit (ADR-012).
- Never calculate SM-2 schedules or mutate review records in UI components; always dispatch through `RecordFlashcardReviewUseCase`.

## Verification

- `npm run test:run` — Runs all flashcard screen, rating mutation, and player tests.
- `npm run lint` — Validates Oxlint boundary guardrails.
- `npm run build` — Validates TypeScript and production bundling.
