import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_STREAM_IDLE_TIMEOUT_MS,
  AiStreamTimeoutError,
  createTimeoutSignal,
  withIdleDeadline,
} from '../deadline';

describe('withIdleDeadline', () => {
  afterEach(() => vi.useRealTimers());

  it('passes a result through untouched when the pull settles in time', async () => {
    await expect(withIdleDeadline(Promise.resolve('first token'), 1_000)).resolves.toBe(
      'first token',
    );
  });

  it('fails a pull that never settles, so a silent provider cannot hold the response open', async () => {
    vi.useFakeTimers();
    const never = new Promise<string>(() => {});
    const settled = expect(withIdleDeadline(never, AI_STREAM_IDLE_TIMEOUT_MS)).rejects.toBeInstanceOf(
      AiStreamTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(AI_STREAM_IDLE_TIMEOUT_MS);

    await settled;
  });

  it('carries the normalized TIMEOUT code the route maps to a status', async () => {
    vi.useFakeTimers();
    const settled = expect(withIdleDeadline(new Promise<string>(() => {}), 1_000)).rejects.toMatchObject(
      { code: 'TIMEOUT' },
    );

    await vi.advanceTimersByTimeAsync(1_000);

    await settled;
  });

  it('propagates a provider failure instead of converting it into a timeout', async () => {
    await expect(withIdleDeadline(Promise.reject(new Error('upstream exploded')), 1_000)).rejects.toThrow(
      'upstream exploded',
    );
  });
});

describe('createTimeoutSignal', () => {
  afterEach(() => vi.useRealTimers());

  it('aborts when the deadline elapses and reports that it did', async () => {
    vi.useFakeTimers();
    const deadline = createTimeoutSignal(undefined, 500);

    expect(deadline.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(500);

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(true);
    deadline.clear();
  });

  it('forwards the caller abort without claiming a timeout', () => {
    const controller = new AbortController();
    const deadline = createTimeoutSignal(controller.signal, 500);

    controller.abort();

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(false);
    deadline.clear();
  });

  it('honors a signal that is already aborted', () => {
    const controller = new AbortController();
    controller.abort();

    const deadline = createTimeoutSignal(controller.signal, 500);

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(false);
    deadline.clear();
  });

  it('stops the deadline once cleared, so a healthy long stream is not cut off', async () => {
    vi.useFakeTimers();
    const deadline = createTimeoutSignal(undefined, 500);

    deadline.clear();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.timedOut()).toBe(false);
  });
});
