import { describe, it, expect } from 'vitest';
import { formatSessionTime } from '../formatSessionTime';

const NOW = new Date('2026-09-19T12:00:00.000Z');

describe('formatSessionTime', () => {
  it('labels a just-updated session', () => {
    expect(formatSessionTime('2026-09-19T11:59:30.000Z', NOW)).toBe('Just now');
  });

  it('reports minutes, hours, and days as compact relative labels', () => {
    expect(formatSessionTime('2026-09-19T11:45:00.000Z', NOW)).toBe('15m ago');
    expect(formatSessionTime('2026-09-19T09:00:00.000Z', NOW)).toBe('3h ago');
    expect(formatSessionTime('2026-09-16T12:00:00.000Z', NOW)).toBe('3d ago');
  });

  it('falls back to a calendar date beyond a week', () => {
    expect(formatSessionTime('2026-08-20T12:00:00.000Z', NOW)).toBe('Aug 20');
  });

  it('returns an empty string for an unparseable timestamp', () => {
    expect(formatSessionTime('not-a-date', NOW)).toBe('');
  });

  it('clamps a future timestamp to "Just now" rather than a negative age', () => {
    expect(formatSessionTime('2026-09-19T12:05:00.000Z', NOW)).toBe('Just now');
  });
});
