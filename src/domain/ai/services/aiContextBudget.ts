/**
 * Provider facts and pure estimators for "how full is the context window?".
 *
 * The window and reserved output are properties of the model, not of a conversation, so they live
 * beside the rate card (`aiModelPricing.ts`) as the other half of what the app knows about Workers AI.
 *
 * Two constants here are mirrored from the Worker and must move in step with it:
 * `AI_RESERVED_OUTPUT_TOKENS` is the `max_tokens` `/api/ai/chat` requests, and the window is a
 * property of the primary model it names. The client cannot import from `worker/`, so the coupling is
 * documented rather than enforced.
 */

/** Primary model's context window, in tokens — prompt **and** response combined. */
export const AI_CONTEXT_WINDOW_TOKENS = 24_000;

/**
 * Output tokens each request reserves (the Worker's `max_tokens`).
 *
 * Verified against a real rejection rather than assumed: Cloudflare refuses a request when
 * **estimated input plus this reservation** exceeds the window —
 * `5021: The estimated number of input and maximum output tokens (8810) exceeded this model context
 * window limit (8192)` — so subtracting it is exactly how much of the window the prompt may use.
 */
export const AI_RESERVED_OUTPUT_TOKENS = 4_096;

/**
 * Tokens the prompt may consume before the request is rejected.
 *
 * This is the provider's own boundary, not a safety margin: Cloudflare computes it as window minus
 * the request's `max_tokens`, so exceeding it produces error 5021 rather than a degraded answer.
 */
export const AI_PROMPT_BUDGET_TOKENS = AI_CONTEXT_WINDOW_TOKENS - AI_RESERVED_OUTPUT_TOKENS;

/**
 * Conventional average for English prose.
 *
 * An approximation, and the reason this module says "estimate": markdown, code, and identifier-dense
 * text (material and turn ids are UUIDs) tokenize nearer 3 characters per token, so this **understates**
 * the token count for realistic study material. It is surfaced as a share of the budget rather than a
 * precise figure, and the provider's own `promptTokens` remains the authoritative number once a turn
 * completes.
 */
export const AI_CHARS_PER_TOKEN = 4;

/** Fixed system prompt and delimiters the Worker composes around every request. */
export const AI_PROMPT_SCAFFOLDING_CHARS = 700;

/** Chat framing each message carries (role marker, delimiters) on top of its content. */
export const AI_MESSAGE_OVERHEAD_TOKENS = 4;

export interface AiPromptCharCounts {
  /** Characters of study material actually sent — cap it through `AiContextBuilder`, not by hand. */
  documentChars: number;
  /** Characters of the attached selection, if any. */
  selectionChars: number;
  /** Characters of every transcript turn being resent. */
  conversationChars: number;
  /** Turns in the request, including the prompt about to be sent. */
  messageCount: number;
}

export interface AiContextUsageEstimate {
  /** Estimated prompt tokens for the next request. */
  estimatedPromptTokens: number;
  promptBudgetTokens: number;
  windowTokens: number;
  /**
   * Share of the prompt budget the estimate consumes. **Not clamped** — it may exceed 1, and the
   * caller decides how to present an overshoot.
   */
  utilization: number;
  /** True when the estimate exceeds the budget, i.e. the next request would risk rejection. */
  isOverBudget: boolean;
}

/**
 * Estimates the prompt size of the next request from character counts.
 *
 * Deliberately a plain ratio plus per-message framing: a real tokenizer would add a large dependency
 * (and still disagree with the model's own tokenizer), while this is enough to warn that a long
 * conversation is approaching the ceiling.
 */
export function estimateContextUsage(counts: AiPromptCharCounts): AiContextUsageEstimate {
  const characters =
    AI_PROMPT_SCAFFOLDING_CHARS +
    Math.max(0, counts.documentChars) +
    Math.max(0, counts.selectionChars) +
    Math.max(0, counts.conversationChars);

  const estimatedPromptTokens =
    Math.ceil(characters / AI_CHARS_PER_TOKEN) +
    Math.max(0, counts.messageCount) * AI_MESSAGE_OVERHEAD_TOKENS;

  return {
    estimatedPromptTokens,
    promptBudgetTokens: AI_PROMPT_BUDGET_TOKENS,
    windowTokens: AI_CONTEXT_WINDOW_TOKENS,
    utilization: estimatedPromptTokens / AI_PROMPT_BUDGET_TOKENS,
    isOverBudget: estimatedPromptTokens > AI_PROMPT_BUDGET_TOKENS,
  };
}
