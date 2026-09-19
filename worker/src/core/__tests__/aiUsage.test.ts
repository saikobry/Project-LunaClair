import { describe, expect, it } from 'vitest';
import { readAiTokenUsage } from '../aiUsage';

describe('readAiTokenUsage', () => {
  it('translates the snake_case payload Cloudflare reports', () => {
    expect(
      readAiTokenUsage({ prompt_tokens: 4820, completion_tokens: 312, total_tokens: 5132 }),
    ).toEqual({ promptTokens: 4820, completionTokens: 312, totalTokens: 5132 });
  });

  it('accepts an already-camelCase payload', () => {
    expect(readAiTokenUsage({ promptTokens: 12, completionTokens: 4 })).toEqual({
      promptTokens: 12,
      completionTokens: 4,
      totalTokens: 16,
    });
  });

  it('derives the total when both components are present', () => {
    expect(readAiTokenUsage({ prompt_tokens: 10, completion_tokens: 5 })).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it('does not derive a total from a partial pair', () => {
    // Summing only `prompt_tokens` would report a total smaller than the request really cost.
    expect(readAiTokenUsage({ prompt_tokens: 10 })).toEqual({ promptTokens: 10 });
  });

  it('keeps a reported total with no components', () => {
    expect(readAiTokenUsage({ total_tokens: 99 })).toEqual({ totalTokens: 99 });
  });

  it('returns undefined when there is nothing usable to report', () => {
    expect(readAiTokenUsage(undefined)).toBeUndefined();
    expect(readAiTokenUsage(null)).toBeUndefined();
    expect(readAiTokenUsage('usage')).toBeUndefined();
    expect(readAiTokenUsage({})).toBeUndefined();
    expect(readAiTokenUsage({ prompt_tokens: 'many' })).toBeUndefined();
  });

  it('rejects negative and non-finite counts rather than reporting them', () => {
    expect(readAiTokenUsage({ prompt_tokens: -1, completion_tokens: Number.NaN })).toBeUndefined();
    expect(readAiTokenUsage({ prompt_tokens: Number.POSITIVE_INFINITY })).toBeUndefined();
  });

  it('keeps a zero count, which is a real report', () => {
    expect(readAiTokenUsage({ prompt_tokens: 0, completion_tokens: 0 })).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });
});
