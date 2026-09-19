import type { AiUsage } from '../models/ai.types';

/**
 * Published Cloudflare Workers AI unit pricing, in USD per million tokens.
 *
 * Kept beside `AiUsage` because it prices exactly that telemetry: the input/output split is a ~7.7x
 * rate difference on the primary model, so a token count without its split cannot be costed.
 *
 * Rates are transcribed from the Cloudflare model pages and are the only thing here that can go
 * stale. A model missing from this table yields no cost (see `estimateAiCostUsd`) rather than a
 * wrong one, so an unrecognised or newly added model degrades to "unknown" instead of silently
 * billing at the wrong rate.
 */
export interface AiModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

/**
 * Rate card keyed by provider model id.
 *
 * `@cf/meta/llama-3.3-70b-instruct-fp8-fast` — $0.293 / M input, $2.253 / M output
 * (https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/).
 *
 * The Worker's fallback model is deliberately absent: it was deprecated on 2026-05-30 and has no
 * current published rate, so a turn it served is reported as cost-unknown.
 */
export const AI_MODEL_PRICING: Readonly<Record<string, AiModelPricing>> = Object.freeze({
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': {
    inputPerMillionUsd: 0.293,
    outputPerMillionUsd: 2.253,
  },
});

/**
 * Estimates the USD cost of one AI turn from the provider's reported token usage.
 *
 * Returns `null` when the cost cannot be known — no usage, no model, an unpriced model, or a usage
 * report missing the input/output split (a total alone cannot be split across two rates). Callers
 * must render that as "unknown"; returning a number here would fabricate a charge.
 */
export function estimateAiCostUsd(usage?: AiUsage | null, model?: string): number | null {
  if (!usage || !model) return null;

  const pricing = AI_MODEL_PRICING[model];
  if (!pricing) return null;

  const { promptTokens, completionTokens } = usage;
  if (typeof promptTokens !== 'number' || typeof completionTokens !== 'number') return null;

  return (
    (promptTokens / 1_000_000) * pricing.inputPerMillionUsd +
    (completionTokens / 1_000_000) * pricing.outputPerMillionUsd
  );
}
