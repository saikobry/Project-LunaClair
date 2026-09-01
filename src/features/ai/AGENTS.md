# src/features/ai/ — AI Study Assistant Feature

## Purpose

AI Study Assistant interface embedded in `MaterialWorkspace`, providing grounded contextual conversations, Socratic tutoring, summaries, and active selection explanations.

## Ownership

- `components/` — UI presentation: `AiChatDrawer`, `AiDrawerToggleButton`, `AiChatMessage`, `AiChatMessageList`, `AiChatInput`, `AiModeSelector`, `AiStreamingIndicator`.
- `hooks/` — Chat stream token hook (`useAiStreamChat`), thread management & reload persistence (`useAiChatThread`).
- `lib/` — Grounded prompt construction (`buildGroundedPrompt`), consuming pure domain context extractor from `src/domain/ai/extractSectionContext`.

## Local Contracts

- `AiChatDrawer` is hosted exclusively at the workspace level in `MaterialWorkspace`.
- Section context extraction bounds prompt tokens to current headings and selections via `src/domain/ai/extractSectionContext`.
- Conversation state persists locally in IndexedDB (`aiThreads`, `aiMessages`).
- Cross-feature consumers import direct paths (e.g. `ai/components/AiChatDrawer`).

## Verification

- `npm run test:run`
- `npm run test:e2e`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files.
