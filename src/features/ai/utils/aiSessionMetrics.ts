import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import { AiContextBuilder } from '../../../domain/ai/context/AiContextBuilder';
import { estimateAiCostUsd } from '../../../domain/ai/services/aiModelPricing';
import {
  estimateContextUsage,
  type AiContextUsageEstimate,
} from '../../../domain/ai/services/aiContextBudget';
import { formatTokenCount, formatUsdCost } from './formatAiUsage';

/** Exact, provider-reported totals across a conversation. */
export interface SessionUsageSummary {
  /** Assistant turns that reported usage. Only these contribute to any total below. */
  meteredTurns: number;
  totalTokens: number;
  totalCostUsd: number;
  /** Turns served by a model with no published rate. Their tokens count; their cost does not. */
  unpricedTurns: number;
  tokenLabel: string;
  /**
   * Cost of the whole conversation, or `null` when it cannot be stated exactly. Any unpriced turn
   * makes the sum a lower bound rather than a total, and a partial figure is not published as if it
   * were complete.
   */
  costLabel: string | null;
}

/**
 * Sums the token usage and cost of every metered assistant turn.
 *
 * Returns `null` when nothing has been metered — a conversation that predates usage telemetry has no
 * totals to show, and reporting zeros would imply measurements that were never taken.
 */
export function summarizeSessionUsage(messages: AiMessageRecord[]): SessionUsageSummary | null {
  let meteredTurns = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;
  let unpricedTurns = 0;

  for (const message of messages) {
    if (message.role !== 'assistant') continue;

    const usage = message.metadata?.usage;
    if (!usage) continue;

    const tokens = usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
    if (!Number.isFinite(tokens) || tokens <= 0) continue;

    meteredTurns += 1;
    totalTokens += tokens;

    const cost = estimateAiCostUsd(usage, message.metadata?.model);
    if (cost === null) unpricedTurns += 1;
    else totalCostUsd += cost;
  }

  if (meteredTurns === 0) return null;

  return {
    meteredTurns,
    totalTokens,
    totalCostUsd,
    unpricedTurns,
    tokenLabel: formatTokenCount(totalTokens),
    costLabel: unpricedTurns === 0 ? formatUsdCost(totalCostUsd) : null,
  };
}

export interface SessionContextEstimate {
  estimate: AiContextUsageEstimate;
  /** Characters actually sent per part, caps applied. */
  documentChars: number;
  selectionChars: number;
  conversationChars: number;
  /**
   * Prompt tokens the provider reported for the most recent metered turn, or `null`.
   *
   * A real measurement of a real request, so it calibrates the estimate — but it describes the
   * *previous* request, which carried one exchange fewer than the next one will.
   */
  lastMeasuredPromptTokens: number | null;
  /** Whole-percent share of the prompt budget, rounded — display only. */
  percent: number;
}

export interface SessionContextInput {
  messages: AiMessageRecord[];
  documentMarkdown?: string;
  selectionText?: string;
}

/**
 * Estimates how much of the model's context window the next request will occupy.
 *
 * Character counts are taken through the same `AiContextBuilder` the request uses, so the document
 * and selection caps here cannot drift from what is actually sent — re-deriving those limits locally
 * is exactly how an estimate goes quietly wrong.
 */
export function estimateSessionContext(input: SessionContextInput): SessionContextEstimate {
  const documentChars =
    AiContextBuilder.buildDocumentContext({
      id: 'context-estimate',
      markdown: input.documentMarkdown,
    })?.markdown.length ?? 0;
  const selectionChars =
    AiContextBuilder.buildSelectionContext({ text: input.selectionText })?.text.length ?? 0;
  const conversationChars = input.messages.reduce((sum, message) => sum + message.content.length, 0);

  const estimate = estimateContextUsage({
    documentChars,
    selectionChars,
    conversationChars,
    // The transcript as it stands, plus the prompt that is about to be appended to it.
    messageCount: input.messages.length + 1,
  });

  let lastMeasuredPromptTokens: number | null = null;
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const usage = input.messages[index]?.metadata?.usage;
    if (typeof usage?.promptTokens === 'number') {
      lastMeasuredPromptTokens = usage.promptTokens;
      break;
    }
  }

  return {
    estimate,
    documentChars,
    selectionChars,
    conversationChars,
    lastMeasuredPromptTokens,
    percent: Math.round(estimate.utilization * 100),
  };
}
