# src/features/ai/ — AI Study Assistant & Content Generation

## Purpose

AI Study Assistant and Content Generation bounded context. Provides conversational grounded context, document summaries, active selection explanations, and LLM-assisted question and flashcard synthesis.

## Ownership

- `components/` — Chat assistant UI presentation: `AiChatDrawer` (thin container), `AiChatDrawerHeader`, `AiDrawerToggleButton`, `AiChatMessage`, `AiChatMessageList`, `AiChatInput`, `AiChatHistoryPanel`, `AiChatErrorBanner`, `AiStreamingIndicator`, `AiMessageUsage` (per-turn token/cost footer), `AiSessionMetrics` (conversation totals + context-window readout), `AiModelPicker` (model choice for the next message, with the over-budget / cooldown notice).
- `hooks/` — `useAiChatThread` (session lifecycle, turn loading, streaming, wait/stall state, and rate-limit cooldown), `useAiModelSelection` (catalog + the per-request model choice, remembered per device, with `refreshCatalog` for a server refusal), `useAiSessionDeletion` (confirm-then-delete for a session or the whole scope), `useAiSelectionAction` (reader selection → one chat turn, deduplicated), `useAiAutoScroll` (transcript viewport pinning), and the unwired `useAiStreamChat` (kept for the streaming port contract; the drawer uses `useAiChatThread`).
- `utils/` — AI markdown sanitization schema (`aiMarkdown.ts`), wait-label escalation ladder (`aiActivity.ts`), session naming (`deriveSessionTitle.ts`), session timestamps (`formatSessionTime.ts`), token/cost formatting (`formatAiUsage.ts` — `formatTokenCount`/`formatUsdCost` are shared by per-turn and per-session labels), conversation totals + context estimation (`aiSessionMetrics.ts`), rate-limit cooldown policy (`aiRateLimit.ts` — `resolveCooldownSeconds`/`formatCooldownNotice`), selection action prompts (`selectionActionPrompt.ts`), and deletion dialog copy (`deletionDialogCopy.ts`).
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
  - **Estimated** — the share of the selected model's window the *next* request will occupy (`estimateSessionContext` → domain `estimateContextUsage`). Derived from character counts at `AI_CHARS_PER_TOKEN`, with the document and selection capped through `AiContextBuilder` so the estimate cannot drift from what is actually sent. The last measured `promptTokens` rides the tooltip as calibration.
  - **The window, output reservation, and document cap are per-model catalog facts**, not constants: `estimateSessionContext({ modelId })` resolves them from `domain/ai/services/aiModelCatalog.ts` (defaulting to the catalog default), so a request on a large-window model is not metered — or document-capped — as if it were the default model. For the default model the served document cap is ~4k tokens against a ~19.9k prompt budget, so **conversation history, not the document, is what approaches the ceiling**; that is not true of a 256k-window model, whose larger cap lets the material itself be large.
- **Model choice is per request, not per session.** `AiChatRequest.model` (and `SendChatMessageInput.model`) carries an app-facing catalog id; the Worker resolves it and reports the serving model on the turn, so a conversation may mix models and every turn stays individually priced. Conversations are **not** pinned to a model and `AiThread` stores none. `useAiModelSelection` owns the choice — catalog-first, device-local (`STORAGE_KEYS.ai.modelId`), and always resolved through the catalog, so a retired or unknown preference degrades to the catalog default instead of being sent and refused. A `MODEL_UNAVAILABLE` refusal from the Worker re-reads the catalog (`refreshCatalog`, wired in `AiChatDrawer`) instead of retrying the refused model — the server can disable a model out of band (`AI_DISABLED_MODELS`), and a stale client catalog is the one thing that could still offer it. `AiModelPicker` renders **only when the catalog offers more than one model** (a single-option control would imply a capability that is not there), and it hides itself if the fetch never lands — the bundled mirror always answers.
- **Two guards sit beside the composer, and each says which problem it is.** Both are derived from the same estimate the metric strip shows, against the *selected* model:
  - **Over budget** — the next request would exceed the selected model's prompt budget, so sending is blocked (`AiChatInput.isSendBlocked`, typing still allowed) and the notice says to start a new chat or switch model. Only an overshoot blocks: the request has not been refused until it is sent.
  - **Rate-limit cooldown** — MAX is free but shared (~5 prompts/minute **per IP**, and a deployment shares one Worker egress IP), so a refusal is normal traffic. New in the same family: the Worker now enforces its own 60s idle deadline per provider pull, so a provider that goes silent surfaces as a `TIMEOUT` turn (and a cancellation as `ABORTED`) instead of a drawer that never settles — these are the server's backstop, while the client's earlier `AI_FIRST_TOKEN_TIMEOUT_MS` remains the user-visible stall guard. The wait the provider named (`retryAfterSeconds`) starts a cooldown in `useAiChatThread`; the composer blocks sends until it elapses, and the guard covers retries too, not just the composer. The countdown is computed from an absolute deadline, so a backgrounded tab resumes at the right remaining time rather than drifting.
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
