import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import { AiContextBuilder } from '../../../domain/ai/context/AiContextBuilder';
import { projectRequestMessages } from '../../../domain/ai/context/aiRequestProjection';
import { estimateAiCostUsd } from '../../../domain/ai/services/aiModelPricing';
import {
  estimateContextUsage,
  type AiContextUsageEstimate,
} from '../../../domain/ai/services/aiContextBudget';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';
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
  /** True when the document context size is indeterminate or currently resolving. */
  isIndeterminate?: boolean;
}

export interface SessionContextInput {
  messages: AiMessageRecord[];
  documentMarkdown?: string;
  /**
   * Capped serialized document characters resolved from GetAiGroundingContextUseCase.
   * If omitted and documentMarkdown is also omitted, treated as unknown/indeterminate.
   */
  documentCharacters?: number;
  selectionText?: string;
  /**
   * The model the next request will use. Omitted = the catalog default.
   *
   * It matters because the document cap and the window are per-model: metering a MAX request with
   * the default model's 16k cap would understate the material by an order of magnitude.
   */
  modelId?: string;
  isIndeterminate?: boolean;
}

/**
 * Estimates how much of the model's context window the next request will occupy.
 *
 * Character counts are taken through the same `AiContextBuilder` the request uses, so the document
 * and selection caps here cannot drift from what is actually sent — re-deriving those limits locally
 * is exactly how an estimate goes quietly wrong.
 *
 * The conversation term is counted over `projectRequestMessages`, the same projection the provider
 * payload is built from. Counting raw records would include error and placeholder turns the payload
 * drops, overstate the next request, and block sends that would in fact have fit.
 */
export function estimateSessionContext(input: SessionContextInput): SessionContextEstimate {
  const requestMessages = projectRequestMessages(input.messages);
  const model = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, input.modelId);

  let documentChars = 0;
  const isIndeterminate = Boolean(input.isIndeterminate);

  if (input.documentCharacters !== undefined) {
    documentChars = input.documentCharacters;
  } else if (input.documentMarkdown !== undefined) {
    documentChars =
      AiContextBuilder.buildDocumentContext({
        id: 'context-estimate',
        markdown: input.documentMarkdown,
        maxCharacters: model.maxDocumentContextChars,
      })?.markdown.length ?? 0;
  }

  const selectionChars =
    AiContextBuilder.buildSelectionContext({ text: input.selectionText })?.text.length ?? 0;
  const conversationChars = requestMessages.reduce((sum, message) => sum + message.content.length, 0);

  const estimate = estimateContextUsage(
    {
      documentChars,
      selectionChars,
      conversationChars,
      // The messages that will actually be sent, plus the prompt about to be appended to them.
      messageCount: requestMessages.length + 1,
    },
    model,
  );

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
    isIndeterminate,
  };
}
