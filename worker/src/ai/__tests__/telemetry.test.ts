import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAiRequestTelemetry,
  logAiRequestTelemetry,
  type AiRequestTelemetry,
} from '../telemetry';

const RECORD: AiRequestTelemetry = {
  status: 200,
  model: 'ukisai-swift-max',
  provider: 'ukisai',
  outcome: 'ok',
  firstEventMs: 412,
  durationMs: 3_180,
  emittedTokenChunks: 240,
  usage: { promptTokens: 1_020, completionTokens: 240 },
};

describe('buildAiRequestTelemetry', () => {
  it('carries the fields intact, tagged so every AI record is one series', () => {
    const parsed = buildAiRequestTelemetry(RECORD) as unknown as Record<string, unknown>;

    expect(parsed.event).toBe('ai.chat');
    expect(parsed.status).toBe(200);
    expect(parsed.model).toBe('ukisai-swift-max');
    expect(parsed.provider).toBe('ukisai');
    expect(parsed.outcome).toBe('ok');
    expect(parsed.firstEventMs).toBe(412);
    expect(parsed.durationMs).toBe(3_180);
    expect(parsed.emittedTokenChunks).toBe(240);
    expect(parsed.usage).toEqual({ promptTokens: 1_020, completionTokens: 240 });
  });

  it('stays a real object, because that is what makes the fields queryable', () => {
    // Workers Logs indexes a logged object's fields; a pre-stringified line would only be searchable
    // as text, which is the difference between a filterable `outcome` column and a grep.
    const built = buildAiRequestTelemetry(RECORD);

    expect(typeof built).toBe('object');
    expect(built).not.toBeInstanceOf(String);
  });

  it('carries no prompt, document, or selection field', () => {
    // The one rule this record must never break. Asserted by key, so a future `...request` spread or
    // a well-meaning "useful context" field fails here rather than in production logs.
    const forbidden = ['prompt', 'messages', 'documentContext', 'document', 'selection', 'content'];
    const parsed = buildAiRequestTelemetry(RECORD) as unknown as Record<string, unknown>;

    for (const key of forbidden) expect(parsed).not.toHaveProperty(key);
  });

  it('truncates vendor error message to 256 characters for sanitization', () => {
    const longMessage = 'A'.repeat(500);
    const parsed = buildAiRequestTelemetry({
      ...RECORD,
      message: longMessage,
    }) as unknown as Record<string, unknown>;

    expect(parsed.message).toHaveLength(256);
    expect(parsed.message).toBe('A'.repeat(253) + '...');
  });

  it('preserves orthogonal stage and reason dimensions', () => {
    const parsed = buildAiRequestTelemetry({
      ...RECORD,
      outcome: 'aborted',
      status: 499,
      stage: 'pre-stream',
      reason: 'client-abort',
    }) as unknown as Record<string, unknown>;

    expect(parsed.stage).toBe('pre-stream');
    expect(parsed.reason).toBe('client-abort');
  });

  it('omits what the provider did not report rather than fabricating a zero', () => {
    const parsed = buildAiRequestTelemetry({
      ...RECORD,
      usage: undefined,
      firstEventMs: undefined,
    }) as unknown as Record<string, unknown>;

    expect(parsed).not.toHaveProperty('usage');
    expect(parsed).not.toHaveProperty('firstEventMs');
    // A *counted* zero is still reported, because zero chunks relayed is itself the finding.
    expect(parsed.emittedTokenChunks).toBe(240);
  });
});

describe('logAiRequestTelemetry', () => {
  const info = vi.spyOn(console, 'log').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    info.mockClear();
    warn.mockClear();
    error.mockClear();
  });

  it.each([
    ['ok', info],
    ['aborted', info],
    ['rejected', warn],
    ['error', error],
  ] as const)('logs %s at the level it deserves', (outcome, spy) => {
    logAiRequestTelemetry({ ...RECORD, outcome });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ event: 'ai.chat', outcome });
  });

  it('logs RATE_LIMITED error outcomes at warn to prevent infrastructure alert spikes', () => {
    logAiRequestTelemetry({
      ...RECORD,
      outcome: 'error',
      code: 'RATE_LIMITED',
      status: 429,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('never reports a user cancellation as an error', () => {
    // A Stop is not a fault: logging it at error level would make the failure rate meaningless.
    logAiRequestTelemetry({ ...RECORD, outcome: 'aborted' });

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('is fail-safe and logs static text without error object when console logging throws', () => {
    info.mockImplementationOnce(() => {
      throw new Error('sensitive console failure info');
    });

    expect(() => logAiRequestTelemetry({ ...RECORD, outcome: 'ok' })).not.toThrow();
    expect(warn).toHaveBeenCalledWith('Failed to emit AI request telemetry');
  });
});
