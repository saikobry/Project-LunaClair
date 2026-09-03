# src/features/ai/ — AI Study Assistant & Content Generation

## Purpose

AI Study Assistant and Content Generation bounded context. Provides conversational grounded context, Socratic tutoring, document summaries, active selection explanations, and LLM-assisted question and flashcard synthesis.

## Ownership

- `components/` — Chat assistant UI presentation: `AiChatDrawer`, `AiDrawerToggleButton`, `AiChatMessage`, `AiChatMessageList`, `AiChatInput`, `AiModeSelector`, `AiStreamingIndicator`.
- `hooks/` — Chat stream token hook (`useAiStreamChat`), thread management & reload persistence (`useAiChatThread`).
- `utils/` — AI markdown sanitization schema (`aiMarkdown.ts`).
- `generator/` — AI Content Generator sub-capability:
  - `components/`: `AiQuestionGeneratorDialog`, `AiFlashcardGeneratorDialog`, `GeneratedQuestionPreviewCard`, `GeneratedFlashcardPreviewCard`.
  - `hooks/`: `useAiQuestionGenerator`, `useAiFlashcardGenerator`.

## Local Contracts

- `AiChatDrawer` is hosted at the workspace level in `MaterialWorkspace`.
- Section context extraction bounds prompt tokens to current headings and selections via `src/domain/ai/extractSectionContext`.
- Conversation state persists locally in IndexedDB (`aiThreads`, `aiMessages`).
- Content generators emit typed question/flashcard drafts validated by domain schemas (`validateQuestionDraft`).
- Cross-feature consumers import direct paths:
  - `ai/components/AiChatDrawer`
  - `ai/components/AiDrawerToggleButton`
  - `ai/generator/components/AiQuestionGeneratorDialog`
  - `ai/generator/components/AiFlashcardGeneratorDialog`

## Verification

- `npm run test:run`
- `npm run test:e2e`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files.
