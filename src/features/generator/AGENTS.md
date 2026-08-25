# src/features/generator/ — AI Content Generator Feature

## Purpose

AI-driven structured assessment question and spaced repetition flashcard generation grounded in study materials.

## Ownership

- `components/` — Modals and preview cards:
  - `AiQuestionGeneratorDialog` — Question generation setup, review, and atomic batch save.
  - `AiFlashcardGeneratorDialog` — Flashcard generation setup, front/back preview review, and save to deck.
  - `GeneratedQuestionPreviewCard` — Question card with schema badge, difficulty, inline edit form, and selection checkbox.
  - `GeneratedFlashcardPreviewCard` — Flashcard card with front/back preview, inline edit form, and selection checkbox.
- `hooks/` — Generator state machines: `useAiQuestionGenerator`, `useAiFlashcardGenerator`.

## Local Contracts

- All AI-generated questions and flashcards are persisted with `status: 'draft'` to the Question Bank.
- Flashcards are mapped to `identification` questions with `tags: ['flashcard', 'ai-generated']`.
- Direct path imports: `QuestionBankTab` imports `generator/components/AiQuestionGeneratorDialog`; `FlashcardScreen` imports `generator/components/AiFlashcardGeneratorDialog`.

## Verification

- `npm run test:run`
- `npm run test:e2e -- tests/e2e/generator/ai-generator.spec.ts`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files.
