import { describe, expect, it } from 'vitest';
import { formatAiUsage } from '../formatAiUsage';

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

describe('formatAiUsage', () => {
  it('renders tokens and cost for a priced model', () => {
    const summary = formatAiUsage({ promptTokens: 4820, completionTokens: 312 }, PRIMARY_MODEL);

    expect(summary?.label).toBe('5,132 tokens · $0.0021');
    expect(summary?.cost).toBe('$0.0021');
    expect(summary?.breakdown).toBe('4,820 in · 312 out');
  });

  it('shortens large counts', () => {
    expect(formatAiUsage({ totalTokens: 12_340 }, PRIMARY_MODEL)?.tokens).toBe('12.3k');
    expect(formatAiUsage({ totalTokens: 9_999 }, PRIMARY_MODEL)?.tokens).toBe('9,999');
    expect(formatAiUsage({ totalTokens: 999 }, PRIMARY_MODEL)?.tokens).toBe('999');
  });

  it('falls back to the component sum when no total is reported', () => {
    expect(formatAiUsage({ promptTokens: 900, completionTokens: 100 }, PRIMARY_MODEL)?.tokens).toBe(
      '1,000',
    );
  });

  it('omits cost, but keeps tokens, when the model has no published rate', () => {
    const summary = formatAiUsage({ promptTokens: 100, completionTokens: 50 }, 'unpriced-model');

    // `cost: null` is distinguishable from "$0" — unknown is not free.
    expect(summary?.cost).toBeNull();
    expect(summary?.label).toBe('150 tokens');
  });

  it('omits cost when a total is reported without the input/output split', () => {
    const summary = formatAiUsage({ totalTokens: 5000 }, PRIMARY_MODEL);

    expect(summary?.cost).toBeNull();
    expect(summary?.breakdown).toBeNull();
    expect(summary?.label).toBe('5,000 tokens');
  });

  it('reports charges below the display resolution honestly', () => {
    const summary = formatAiUsage({ promptTokens: 1, completionTokens: 0 }, PRIMARY_MODEL);

    expect(summary?.cost).toBe('<$0.0001');
  });

  it('returns null when there is nothing worth showing', () => {
    expect(formatAiUsage(undefined, PRIMARY_MODEL)).toBeNull();
    expect(formatAiUsage(null, PRIMARY_MODEL)).toBeNull();
    expect(formatAiUsage({})).toBeNull();
    // A zero-token report would render as "0 tokens", which states nothing about the turn.
    expect(formatAiUsage({ totalTokens: 0 })).toBeNull();
    expect(formatAiUsage({ promptTokens: 0, completionTokens: 0 }, PRIMARY_MODEL)).toBeNull();
  });
});
