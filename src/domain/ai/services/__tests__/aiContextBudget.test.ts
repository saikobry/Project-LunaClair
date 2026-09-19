import { describe, expect, it } from 'vitest';
import {
  AI_CHARS_PER_TOKEN,
  AI_CONTEXT_WINDOW_TOKENS,
  AI_MESSAGE_OVERHEAD_TOKENS,
  AI_PROMPT_BUDGET_TOKENS,
  AI_PROMPT_SCAFFOLDING_CHARS,
  AI_RESERVED_OUTPUT_TOKENS,
  estimateContextUsage,
} from '../aiContextBudget';

const empty = { documentChars: 0, selectionChars: 0, conversationChars: 0, messageCount: 0 };

describe('context budget constants', () => {
  it('reserves output out of the window rather than adding to it', () => {
    // The window is prompt + response combined, so the budget must be the remainder.
    expect(AI_PROMPT_BUDGET_TOKENS).toBe(AI_CONTEXT_WINDOW_TOKENS - AI_RESERVED_OUTPUT_TOKENS);
    expect(AI_PROMPT_BUDGET_TOKENS).toBeLessThan(AI_CONTEXT_WINDOW_TOKENS);
  });
});

describe('estimateContextUsage', () => {
  it('counts the scaffolding even for an otherwise empty request', () => {
    const estimate = estimateContextUsage(empty);

    expect(estimate.estimatedPromptTokens).toBe(Math.ceil(AI_PROMPT_SCAFFOLDING_CHARS / AI_CHARS_PER_TOKEN));
  });

  it('scales with the document', () => {
    const small = estimateContextUsage({ ...empty, documentChars: 1000 });
    const large = estimateContextUsage({ ...empty, documentChars: 16_000 });

    expect(large.estimatedPromptTokens).toBeGreaterThan(small.estimatedPromptTokens);
    // 16,000 chars at 4 chars/token is 4,000 tokens, plus scaffolding.
    expect(large.estimatedPromptTokens).toBe(4_000 + Math.ceil(AI_PROMPT_SCAFFOLDING_CHARS / 4));
  });

  it('adds every part of the request', () => {
    const estimate = estimateContextUsage({
      documentChars: 4_000,
      selectionChars: 400,
      conversationChars: 1_000,
      messageCount: 10,
    });

    expect(estimate.estimatedPromptTokens).toBe(
      Math.ceil((AI_PROMPT_SCAFFOLDING_CHARS + 5_400) / 4) + 10 * AI_MESSAGE_OVERHEAD_TOKENS,
    );
  });

  it('charges per-message framing on top of content', () => {
    const oneTurn = estimateContextUsage({ ...empty, messageCount: 2 });
    const twentyTurns = estimateContextUsage({ ...empty, messageCount: 20 });

    expect(twentyTurns.estimatedPromptTokens - oneTurn.estimatedPromptTokens).toBe(
      18 * AI_MESSAGE_OVERHEAD_TOKENS,
    );
  });

  it('reports utilization against the prompt budget, not the window', () => {
    const estimate = estimateContextUsage(empty);

    expect(estimate.utilization).toBeCloseTo(estimate.estimatedPromptTokens / AI_PROMPT_BUDGET_TOKENS, 10);
    expect(estimate.promptBudgetTokens).toBe(AI_PROMPT_BUDGET_TOKENS);
    expect(estimate.windowTokens).toBe(AI_CONTEXT_WINDOW_TOKENS);
  });

  it('flags an over-budget request and lets utilization exceed 1 rather than clamping it', () => {
    // 19,904 budget tokens is roughly 79,000 characters of content.
    const estimate = estimateContextUsage({ ...empty, documentChars: 200_000 });

    expect(estimate.isOverBudget).toBe(true);
    // Clamping here would hide how far past the ceiling the request is.
    expect(estimate.utilization).toBeGreaterThan(1);
  });

  it('does not flag a request that lands exactly on the budget', () => {
    const budgetChars = AI_PROMPT_BUDGET_TOKENS * AI_CHARS_PER_TOKEN - AI_PROMPT_SCAFFOLDING_CHARS;
    const estimate = estimateContextUsage({ ...empty, documentChars: budgetChars });

    expect(estimate.estimatedPromptTokens).toBe(AI_PROMPT_BUDGET_TOKENS);
    expect(estimate.isOverBudget).toBe(false);
  });

  it('ignores negative counts instead of crediting back budget', () => {
    expect(estimateContextUsage({ ...empty, documentChars: -5_000, messageCount: -3 })).toEqual(
      estimateContextUsage(empty),
    );
  });
});
