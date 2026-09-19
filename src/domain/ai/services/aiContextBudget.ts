/**
 * Pure estimators for "how full is the context window?".
 *
 * The window and reserved output are properties of a **model**, so they come from the model catalog
 * (`aiModelCatalog.ts`) rather than from constants on this module. The exported constants below are
 * the default model's facts, kept for callers that have no model in hand.
 *
 * `AI_RESERVED_OUTPUT_TOKENS` must equal the `max_tokens` the Worker sends: Cloudflare validates a
 * request against estimated input **plus that reservation**, verified against a real rejection —
 * `5021: The estimated number of input and maximum output tokens (8810) exceeded this model context
 * window limit (8192)` — so subtracting it is exactly how much of the window the prompt may use.
 */

import { DEFAULT_AI_MODEL_CATALOG, getAiModelDescriptor } from './aiModelCatalog';

/** The facts a budget estimate needs; any catalog descriptor satisfies this. */
export interface AiModelBudgetFacts {
  contextWindowTokens: number;
  maxOutputTokens: number;
}

const DEFAULT_MODEL = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG);

/** Default model's context window, in tokens — prompt **and** response combined. */
export const AI_CONTEXT_WINDOW_TOKENS = DEFAULT_MODEL.contextWindowTokens;

/** Output tokens each request reserves (the Worker's `max_tokens`) for the default model. */
export const AI_RESERVED_OUTPUT_TOKENS = DEFAULT_MODEL.maxOutputTokens;

/**
 * Tokens the prompt may consume before the request is rejected.
 *
 * This is the provider's own boundary, not a safety margin: it computes it as window minus the
 * request's `max_tokens`, so exceeding it produces a provider rejection rather than a degraded answer.
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
 *
 * Pass the served model's facts; omitting them meters against the default model, which is what a
 * request that names no model uses.
 */
export function estimateContextUsage(
  counts: AiPromptCharCounts,
  model: AiModelBudgetFacts = DEFAULT_MODEL,
): AiContextUsageEstimate {
  const characters =
    AI_PROMPT_SCAFFOLDING_CHARS +
    Math.max(0, counts.documentChars) +
    Math.max(0, counts.selectionChars) +
    Math.max(0, counts.conversationChars);

  const estimatedPromptTokens =
    Math.ceil(characters / AI_CHARS_PER_TOKEN) +
    Math.max(0, counts.messageCount) * AI_MESSAGE_OVERHEAD_TOKENS;

  const promptBudgetTokens = model.contextWindowTokens - model.maxOutputTokens;

  return {
    estimatedPromptTokens,
    promptBudgetTokens,
    windowTokens: model.contextWindowTokens,
    utilization: estimatedPromptTokens / promptBudgetTokens,
    isOverBudget: estimatedPromptTokens > promptBudgetTokens,
  };
}
