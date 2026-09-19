import type { AiUsage } from '../../../domain/ai/models/ai.types';
import { estimateAiCostUsd } from '../../../domain/ai/services/aiModelPricing';

/** Presentation-ready summary of one turn's provider-reported token usage. */
export interface AiUsageSummary {
  /** Formatted total, e.g. `1,204` or `12.3k`. */
  tokens: string;
  /** Formatted USD cost, or `null` when the model's rate is unknown. */
  cost: string | null;
  /** Prompt/completion split, or `null` when the provider reported only a total. */
  breakdown: string | null;
  /** Single-line label for the transcript, e.g. `1,204 tokens · $0.0016`. */
  label: string;
}

const plainNumber = new Intl.NumberFormat('en-US');

/**
 * Deliberately not `Intl` compact notation: the suffix casing varies by engine and locale, which
 * would make the transcript's own label untestable for no gain.
 *
 * Exported so per-turn and per-session labels cannot drift apart.
 */
export function formatTokenCount(count: number): string {
  if (count < 1_000) return String(count);
  if (count < 10_000) return plainNumber.format(count);
  return `${(count / 1_000).toFixed(1)}k`;
}

/**
 * Four decimals is the useful resolution here: a typical turn costs a fraction of a cent, and any
 * smaller charge would otherwise render as a misleading "$0.0000".
 *
 * Exported so per-turn and per-session labels cannot drift apart.
 */
export function formatUsdCost(cost: number): string {
  if (cost < 0.0001) return '<$0.0001';
  return `$${cost.toFixed(4)}`;
}

/**
 * Formats a persisted turn's token telemetry for display.
 *
 * Returns `null` when there is nothing worth showing — no usage, or a report with no positive token
 * count (a zero-token turn would read as "0 tokens · $0", which states nothing). Cost is reported as
 * `null` rather than omitted when the rate is unknown, so the caller can distinguish "unpriced" from
 * "free" instead of silently implying the latter.
 *
 * Cost is never zero for a shown summary: both published rates are positive, so a positive token
 * count always costs something.
 */
export function formatAiUsage(usage?: AiUsage | null, model?: string): AiUsageSummary | null {
  if (!usage) return null;

  const totalTokens =
    usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return null;

  const cost = estimateAiCostUsd(usage, model);
  const tokens = formatTokenCount(totalTokens);
  const costLabel = cost === null ? null : formatUsdCost(cost);

  const hasSplit =
    typeof usage.promptTokens === 'number' && typeof usage.completionTokens === 'number';
  const breakdown = hasSplit
    ? `${plainNumber.format(usage.promptTokens as number)} in · ${plainNumber.format(usage.completionTokens as number)} out`
    : null;

  return {
    tokens,
    cost: costLabel,
    breakdown,
    label: costLabel ? `${tokens} tokens · ${costLabel}` : `${tokens} tokens`,
  };
}
