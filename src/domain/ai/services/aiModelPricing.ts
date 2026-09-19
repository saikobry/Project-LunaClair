import type { AiUsage } from '../models/ai.types';
import {
  DEFAULT_AI_MODEL_CATALOG,
  findAiModelDescriptor,
  type AiModelCatalog,
  type AiModelPricing,
} from './aiModelCatalog';

/**
 * Cost estimation over the model catalog's published rates.
 *
 * Kept beside `AiUsage` because it prices exactly that telemetry: the input/output split is a ~7.7x
 * rate difference on the default model, so a token count without its split cannot be costed.
 *
 * Rates now live on the model catalog rather than in a second table, so a model's window, document
 * budget, and price are stated in one place. Rates are the part that can go stale; a model with no
 * rate yields no cost (see `estimateAiCostUsd`) rather than a wrong one.
 */
export type { AiModelPricing };

/**
 * Estimates the USD cost of one AI turn from the provider's reported token usage.
 *
 * Returns `null` when the cost cannot be known — no usage, no model, an unknown or free model, or a
 * usage report missing the input/output split (a total alone cannot be split across two rates).
 * Callers must render that as "unknown"; returning a number here would fabricate a charge.
 *
 * The model may be given as a catalog id or as the provider model id persisted by earlier builds.
 */
export function estimateAiCostUsd(
  usage?: AiUsage | null,
  model?: string,
  catalog: AiModelCatalog = DEFAULT_AI_MODEL_CATALOG,
): number | null {
  if (!usage || !model) return null;

  const pricing = findAiModelDescriptor(catalog, model)?.pricing;
  if (!pricing) return null;

  const { promptTokens, completionTokens } = usage;
  if (typeof promptTokens !== 'number' || typeof completionTokens !== 'number') return null;

  return (
    (promptTokens / 1_000_000) * pricing.inputPerMillionUsd +
    (completionTokens / 1_000_000) * pricing.outputPerMillionUsd
  );
}
