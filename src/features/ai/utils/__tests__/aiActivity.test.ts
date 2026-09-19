import { describe, it, expect } from 'vitest';
import {
  AI_ACTIVITY_STALL_MS,
  resolveAiActivity,
} from '../aiActivity';

describe('resolveAiActivity', () => {
  it('starts on a generic label that does not claim the model has answered', () => {
    const activity = resolveAiActivity(0);
    expect(activity.label).toBe('Thinking…');
    expect(activity.isStalled).toBe(false);
  });

  it('rotates labels as the request runs on', () => {
    const early = resolveAiActivity(0).label;
    const later = resolveAiActivity(3_000).label;

    expect(later).not.toBe(early);
    expect(resolveAiActivity(6_000).label).not.toBe(later);
  });

  it('does not claim a stall before the threshold', () => {
    expect(resolveAiActivity(AI_ACTIVITY_STALL_MS - 1).isStalled).toBe(false);
  });

  it('escalates to an elapsed-seconds stall warning at the threshold', () => {
    const stalled = resolveAiActivity(AI_ACTIVITY_STALL_MS);
    expect(stalled.isStalled).toBe(true);
    expect(stalled.label).toBe('Still working… 10s');

    expect(resolveAiActivity(24_400).label).toBe('Still working… 24s');
  });

  it('normalises non-positive and non-finite deltas to zero', () => {
    expect(resolveAiActivity(-500).elapsedMs).toBe(0);
    expect(resolveAiActivity(Number.NaN).elapsedMs).toBe(0);
    expect(resolveAiActivity(-500).label).toBe('Thinking…');
  });
});
