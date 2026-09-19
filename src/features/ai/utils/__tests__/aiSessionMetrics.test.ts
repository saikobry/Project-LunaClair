import { describe, expect, it } from 'vitest';
import {
  estimateSessionContext,
  summarizeSessionUsage,
} from '../aiSessionMetrics';
import type { AiMessageRecord } from '../../../../domain/ai/models/ai.types';

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function assistantTurn(
  id: string,
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
  model = PRIMARY_MODEL,
  overrides: Partial<AiMessageRecord> = {},
): AiMessageRecord {
  return {
    id,
    threadId: 'th-1',
    role: 'assistant',
    content: 'An answer.',
    status: 'complete',
    createdAt: '2026-09-19T00:00:00.000Z',
    metadata: { usage, model },
    ...overrides,
  };
}

function userTurn(id: string, content = 'A question.'): AiMessageRecord {
  return {
    id,
    threadId: 'th-1',
    role: 'user',
    content,
    status: 'complete',
    createdAt: '2026-09-19T00:00:00.000Z',
  };
}

describe('summarizeSessionUsage', () => {
  it('returns null when no turn was ever metered', () => {
    expect(summarizeSessionUsage([])).toBeNull();
    expect(summarizeSessionUsage([userTurn('u1')])).toBeNull();
    // An assistant turn with no telemetry is unmetered, not a zero-token turn.
    expect(
      summarizeSessionUsage([
        { ...assistantTurn('a1', {}), metadata: undefined },
      ]),
    ).toBeNull();
  });

  it('sums the provider-reported totals across turns', () => {
    const summary = summarizeSessionUsage([
      userTurn('u1'),
      assistantTurn('a1', { promptTokens: 4820, completionTokens: 312, totalTokens: 5132 }),
      userTurn('u2'),
      assistantTurn('a2', { promptTokens: 5200, completionTokens: 180, totalTokens: 5380 }),
    ]);

    expect(summary?.meteredTurns).toBe(2);
    expect(summary?.totalTokens).toBe(10_512);
    expect(summary?.tokenLabel).toBe('10.5k');
    // 4,820/312 at $0.293/$2.253 per M, plus 5,200/180 at the same rates.
    expect(summary?.costLabel).toBe('$0.0040');
    expect(summary?.unpricedTurns).toBe(0);
  });

  it('falls back to the component sum when a turn reports no total', () => {
    const summary = summarizeSessionUsage([assistantTurn('a1', { promptTokens: 900, completionTokens: 100 })]);

    expect(summary?.totalTokens).toBe(1_000);
  });

  it('counts a turn that failed after consuming tokens', () => {
    const summary = summarizeSessionUsage([
      assistantTurn(
        'a1',
        { promptTokens: 4820, completionTokens: 40, totalTokens: 4860 },
        PRIMARY_MODEL,
        { status: 'error', metadata: { usage: { promptTokens: 4820, completionTokens: 40, totalTokens: 4860 }, model: PRIMARY_MODEL, errorCode: 'STREAM_ERROR' } },
      ),
    ]);

    expect(summary?.meteredTurns).toBe(1);
    expect(summary?.totalTokens).toBe(4_860);
  });

  it('withholds a total cost when any turn could not be priced', () => {
    const summary = summarizeSessionUsage([
      assistantTurn('a1', { promptTokens: 1000, completionTokens: 100, totalTokens: 1100 }),
      assistantTurn('a2', { promptTokens: 1000, completionTokens: 100, totalTokens: 1100 }, 'unpriced-model'),
    ]);

    expect(summary?.totalTokens).toBe(2_200);
    expect(summary?.unpricedTurns).toBe(1);
    // A partial sum is a lower bound, and publishing it as the conversation's cost would misstate it.
    expect(summary?.costLabel).toBeNull();
  });

  it('skips turns whose usage reports nothing positive', () => {
    const summary = summarizeSessionUsage([
      assistantTurn('a1', { totalTokens: 0 }),
      assistantTurn('a2', { promptTokens: 300, completionTokens: 100, totalTokens: 400 }),
    ]);

    expect(summary?.meteredTurns).toBe(1);
    expect(summary?.totalTokens).toBe(400);
  });
});

describe('estimateSessionContext', () => {
  it('caps the document through the builder the request itself uses', () => {
    const fortyThousand = 'x'.repeat(40_000);
    const twoHundredThousand = 'x'.repeat(200_000);

    const a = estimateSessionContext({ messages: [], documentMarkdown: fortyThousand });
    const b = estimateSessionContext({ messages: [], documentMarkdown: twoHundredThousand });

    // Both are clamped to the same served size, so the estimate cannot grow without bound.
    expect(a.documentChars).toBe(b.documentChars);
    expect(a.documentChars).toBeGreaterThanOrEqual(16_000);
    expect(a.documentChars).toBeLessThan(40_000);
  });

  it('caps the selection at the served size', () => {
    const huge = estimateSessionContext({ messages: [], selectionText: 'y'.repeat(20_000) });
    const normal = estimateSessionContext({ messages: [], selectionText: 'y'.repeat(1_000) });

    expect(huge.selectionChars).toBeGreaterThanOrEqual(4_000);
    expect(huge.selectionChars).toBeLessThan(5_000);
    expect(normal.selectionChars).toBe(1_000);
  });

  it('counts the whole transcript as conversation input', () => {
    const messages = [userTurn('u1', 'a'.repeat(400)), assistantTurn('a1', { totalTokens: 10 }, PRIMARY_MODEL, { content: 'b'.repeat(600) })];

    expect(estimateSessionContext({ messages }).conversationChars).toBe(1_000);
  });

  it('stays small for an empty conversation', () => {
    const context = estimateSessionContext({ messages: [] });

    expect(context.percent).toBeLessThan(5);
    expect(context.estimate.isOverBudget).toBe(false);
    expect(context.lastMeasuredPromptTokens).toBeNull();
  });

  it('cannot exhaust the budget with the document alone, because the served cap bounds it', () => {
    // The document is capped at 16k characters (~4k tokens) against a ~19.9k prompt budget, so a
    // huge material on its own never approaches the ceiling — history is what gets there.
    const context = estimateSessionContext({ messages: [], documentMarkdown: 'x'.repeat(200_000) });

    expect(context.estimate.isOverBudget).toBe(false);
    expect(context.percent).toBeLessThan(25);
  });

  it('flags a long conversation that exhausts the prompt budget', () => {
    const messages = Array.from({ length: 30 }, (_, index) =>
      userTurn(`u${index}`, 'x'.repeat(3_000)),
    );

    const context = estimateSessionContext({ messages });

    // ~90,000 characters of transcript is ~22,500 tokens against a ~19,904 budget.
    expect(context.estimate.isOverBudget).toBe(true);
    expect(context.percent).toBeGreaterThan(100);
  });

  it('meters a MAX request against MAX, not the default model', () => {
    // The document cap and the window are both per-model, so the model choice is what the readout
    // must reflect: MAX sends an order of magnitude more material, metered against a far larger window.
    const documentMarkdown = 'x'.repeat(200_000);

    const standard = estimateSessionContext({ messages: [], documentMarkdown });
    const max = estimateSessionContext({ messages: [], documentMarkdown, modelId: 'ukisai-swift-max' });

    expect(standard.documentChars).toBeGreaterThanOrEqual(16_000);
    expect(standard.documentChars).toBeLessThan(17_000);
    expect(max.documentChars).toBeGreaterThan(150_000);
    expect(max.documentChars).toBeLessThan(161_000);
    expect(max.estimate.windowTokens).toBeGreaterThan(standard.estimate.windowTokens);
    expect(max.estimate.isOverBudget).toBe(false);
  });

  it('falls back to the default model for an unknown model id', () => {
    expect(estimateSessionContext({ messages: [], modelId: 'unknown-model' }).estimate).toEqual(
      estimateSessionContext({ messages: [] }).estimate,
    );
  });

  it('reports the most recent measured prompt to calibrate the estimate', () => {
    const context = estimateSessionContext({
      messages: [
        assistantTurn('a1', { promptTokens: 1111, completionTokens: 10 }, PRIMARY_MODEL),
        userTurn('u2'),
        assistantTurn('a2', { promptTokens: 6220, completionTokens: 20 }, PRIMARY_MODEL),
      ],
    });

    expect(context.lastMeasuredPromptTokens).toBe(6_220);
  });

  it('skips turns with no reported prompt when calibrating', () => {
    const context = estimateSessionContext({
      messages: [
        assistantTurn('a1', { promptTokens: 4000, completionTokens: 10 }, PRIMARY_MODEL),
        assistantTurn('a2', { completionTokens: 20 }, PRIMARY_MODEL),
      ],
    });

    expect(context.lastMeasuredPromptTokens).toBe(4_000);
  });

  it('rounds the displayed share of budget', () => {
    const context = estimateSessionContext({ messages: [] });

    expect(context.percent).toBe(Math.round(context.estimate.utilization * 100));
  });
});
