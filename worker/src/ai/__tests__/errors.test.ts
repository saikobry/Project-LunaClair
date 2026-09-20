import { describe, expect, it } from 'vitest';
import {
  classifyAiFailure,
  extractAiFailureSignal,
  toAiProviderError,
  type AiFailureSignal,
} from '../errors';
import { AiProviderError } from '../types';

describe('classifyAiFailure — structured signals first', () => {
  it('believes an HTTP 429 even when the message says nothing useful', () => {
    expect(classifyAiFailure('Request rejected.', { status: 429 })).toBe('RATE_LIMITED');
  });

  it('reads a gateway timeout as TIMEOUT, not as an upstream error', () => {
    expect(classifyAiFailure('upstream', { status: 504 })).toBe('TIMEOUT');
    expect(classifyAiFailure('upstream', { status: 408 })).toBe('TIMEOUT');
  });

  it('trusts a declared error type over the prose beside it', () => {
    // The message wording is deliberately unhelpful: the type is the signal.
    expect(
      classifyAiFailure('Please adjust your request.', { status: 400, type: 'rate_limit_exceeded' }),
    ).toBe('RATE_LIMITED');
    expect(
      classifyAiFailure('Something went wrong.', { status: 400, type: 'context_length_exceeded' }),
    ).toBe('CONTEXT_LIMIT');
  });

  it('reads a declared numeric code from the observed-codes table', () => {
    expect(classifyAiFailure('rejected', { code: 5021 })).toBe('CONTEXT_LIMIT');
    expect(classifyAiFailure('rejected', { code: '5021' })).toBe('CONTEXT_LIMIT');
  });

  it('reads a platform code that only prefixes the message', () => {
    expect(
      classifyAiFailure(
        '5021: The estimated number of input and maximum output tokens (8810) exceeded this model context window limit (8192)',
      ),
    ).toBe('CONTEXT_LIMIT');
  });

  it('does not guess at an unrecognized numeric code', () => {
    expect(classifyAiFailure('rejected', { code: 9999 })).toBe('UPSTREAM_ERROR');
  });
});

describe('classifyAiFailure — message fallback', () => {
  it('still classifies a provider that declares nothing', () => {
    expect(classifyAiFailure('Rate limit: 5 prompts per minute per IP.')).toBe('RATE_LIMITED');
    expect(classifyAiFailure('This model maximum context length is 8192 tokens.')).toBe(
      'CONTEXT_LIMIT',
    );
  });

  it('does not mistake a rate limit for a context problem', () => {
    expect(classifyAiFailure('Rate limit exceeded. Try again in 7s.')).toBe('RATE_LIMITED');
  });

  it('reports anything unrecognized as an upstream error', () => {
    expect(classifyAiFailure('socket hang up')).toBe('UPSTREAM_ERROR');
  });
});

describe('extractAiFailureSignal', () => {
  it('reads the HTTP-ish properties a thrown value may carry', () => {
    expect(extractAiFailureSignal({ status: 429, code: 'rate_limited' })).toEqual({
      status: 429,
      code: 'rate_limited',
    });
    expect(extractAiFailureSignal({ statusCode: 504 })).toEqual({ status: 504 });
  });

  it('ignores values that declare nothing usable', () => {
    expect(extractAiFailureSignal(new Error('boom'))).toBeUndefined();
    expect(extractAiFailureSignal(undefined)).toBeUndefined();
    expect(extractAiFailureSignal('boom')).toBeUndefined();
    expect(extractAiFailureSignal({ status: 'fast' })).toBeUndefined();
  });
});

describe('toAiProviderError', () => {
  it('passes an already-typed provider error through unchanged', () => {
    const original = new AiProviderError('nope', 'CONTEXT_LIMIT');

    expect(toAiProviderError(original)).toBe(original);
  });

  it('classifies a thrown error from its own structured properties', () => {
    expect(toAiProviderError({ status: 429, message: 'slow down' })).toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('falls back to message matching when nothing is declared', () => {
    expect(toAiProviderError(new Error('too many requests'))).toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('uses the caller-supplied signal over the thrown value', () => {
    const signal: AiFailureSignal = { status: 504 };

    expect(toAiProviderError(new Error('read ECONNRESET'), 'failed', signal)).toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('reports an unclassifiable failure with the fallback message', () => {
    expect(toAiProviderError(undefined)).toMatchObject({
      code: 'UPSTREAM_ERROR',
      message: 'AI stream failed',
    });
  });
});
