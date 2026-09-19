# src/features/ai/ — AI Study Assistant & Content Generation

## Purpose

AI Study Assistant and Content Generation bounded context. Provides conversational grounded context, document summaries, active selection explanations, and LLM-assisted question and flashcard synthesis.

## Ownership

- `components/` — Chat assistant UI presentation: `AiChatDrawer` (thin container), `AiChatDrawerHeader`, `AiDrawerToggleButton`, `AiChatMessage`, `AiChatMessageList`, `AiChatInput`, `AiChatHistoryPanel`, `AiChatErrorBanner`, `AiStreamingIndicator`, `AiMessageUsage` (per-turn token/cost footer), `AiSessionMetrics` (conversation totals + context-window readout).
- `hooks/` — `useAiChatThread` (session lifecycle, turn loading, streaming, wait/stall state), `useAiSessionDeletion` (confirm-then-delete for a session or the whole scope), `useAiSelectionAction` (reader selection → one chat turn, deduplicated), `useAiAutoScroll` (transcript viewport pinning), and the unwired `useAiStreamChat` (kept for the streaming port contract; the drawer uses `useAiChatThread`).
- `utils/` — AI markdown sanitization schema (`aiMarkdown.ts`), wait-label escalation ladder (`aiActivity.ts`), session naming (`deriveSessionTitle.ts`), session timestamps (`formatSessionTime.ts`), token/cost formatting (`formatAiUsage.ts` — `formatTokenCount`/`formatUsdCost` are shared by per-turn and per-session labels), conversation totals + context estimation (`aiSessionMetrics.ts`), selection action prompts (`selectionActionPrompt.ts`), and deletion dialog copy (`deletionDialogCopy.ts`).
- `generator/` — AI Content Generator sub-capability:
  - `components/`: `AiQuestionGeneratorDialog`, `AiFlashcardGeneratorDialog`, `GeneratedQuestionPreviewCard`, `GeneratedFlashcardPreviewCard`.
  - `hooks/`: `useAiQuestionGenerator`, `useAiFlashcardGenerator`.

## Local Contracts

- `AiChatDrawer` is hosted at the workspace level in `MaterialWorkspace`. It is a non-modal overlay with its own backdrop, so it locks page scroll itself through the shared `useBodyScrollLock` (`isOpen`) — the same page-behind-will-not-scroll behaviour the native-`<dialog>` surfaces get from `useModalDialog`.
- **Conversations are sessions, and a session is the unit of history.** Sessions are scoped to one study material (`AiThread.materialId`); a material holds many, ordered newest-first by `updatedAt`. `ResolveAiThreadUseCase` reopens the newest and **never creates one**, so an unused material shows the composer's empty state instead of an empty history row. `CreateAiThreadUseCase` always inserts a distinct session, so **New chat never deletes or replaces earlier conversations**.
- **There is no user-facing tutor-mode selector.** `AiTutorMode` survives as a server-side prompt capability only; the client always sends `assistant`. Quiz/flashcard generation and the reader's Explain/Simplify/Example actions are prompt presets on their own surfaces and have never depended on modes or thread identity.
- **A session is named from its first prompt** (`deriveSessionTitle`, fire-and-forget via `RenameAiThreadUseCase`) so history rows are identifiable. Failures must never break the conversation.
- **In-flight assistant work is always visible in the transcript, not only in the composer.** `AiChatMessageList` projects a provisional assistant turn from `streamingText`; before the first token it shows the `activity` label (`resolveAiActivity`): rotating generic labels, escalating to an explicit elapsed-seconds stall warning at `AI_ACTIVITY_STALL_MS`, and abandoning the request at `firstTokenTimeoutMs` (default `AI_FIRST_TOKEN_TIMEOUT_MS`) with a retryable `TIMEOUT` error.
- **Request-level failures render in `AiChatErrorBanner`** (stalled first token, transport failure, session creation failure). Failures that were persisted as their own turn carry the error inline instead, and the hook clears the banner so the two never duplicate.
- **A settled assistant turn reports what it actually cost.** The Worker forwards the provider's token usage and the serving model on the terminal `done` event; `SendChatMessageUseCase` persists both on the turn, and `AiMessageUsage` → `formatAiUsage` → domain `estimateAiCostUsd` renders the count and the derived charge. The prompt/completion split lives in the element's `title`, not in the transcript. An unpriced model shows tokens with no cost — unknown is never rendered as free, and telemetry is never fabricated client-side.
- **The drawer reports what a conversation has cost and how full the model's window is** (`AiSessionMetrics`, above the composer; it steps aside while the history panel shows). Two kinds of number, deliberately not blended:
  - **Measured** — session totals summed from the provider's own reports on settled turns (`summarizeSessionUsage`). A total cost is withheld entirely when any turn was unpriced, because a partial sum is a lower bound and publishing it as the conversation's cost would misstate it.
  - **Estimated** — the share of the 24k window the *next* request will occupy (`estimateSessionContext` → domain `estimateContextUsage`). Derived from character counts at `AI_CHARS_PER_TOKEN`, with the document and selection capped through `AiContextBuilder` so the estimate cannot drift from what is actually sent. The last measured `promptTokens` rides the tooltip as calibration.
  - The window and its 4,096 reserved output tokens are **mirrored from the Worker** (primary model, `max_tokens`) in `domain/ai/services/aiContextBudget.ts`. Because the served document cap is ~4k tokens against a ~19.9k prompt budget, **conversation history — not the document — is what approaches the ceiling.**
- `AiChatDrawer` stays a thin container. Session lifecycle and streaming live in `useAiChatThread`, the deletion flow in `useAiSessionDeletion`, the selection handoff in `useAiSelectionAction`, and presentation in the components above. Put new logic in one of those rather than back in the drawer.
- Section context extraction bounds prompt tokens to current headings and selections via `src/domain/ai/context/extractSectionContext`.
- Conversation state persists locally in IndexedDB (`aiThreads`, `aiMessages`). AI history is **not** part of the sync entity model, so sessions are device-local.
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
