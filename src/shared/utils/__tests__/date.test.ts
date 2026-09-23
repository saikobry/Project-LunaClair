import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../date';

describe('formatRelativeTime', () => {
  it('returns "Never opened" for null, undefined, empty, or invalid ISO strings', () => {
    expect(formatRelativeTime(undefined)).toBe('Never opened');
    expect(formatRelativeTime(null)).toBe('Never opened');
    expect(formatRelativeTime('')).toBe('Never opened');
    expect(formatRelativeTime('not-a-date')).toBe('Never opened');
  });

  it('returns "Just now" for future timestamps', () => {
    const futureDate = new Date(Date.now() + 60 * 1000).toISOString();
    expect(formatRelativeTime(futureDate)).toBe('Just now');
  });

  it('returns "Just now" for timestamps under 1 hour ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('Just now');

    const fiftyNineMinutesAgo = new Date(Date.now() - 59 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('Just now');
  });

  it('returns hours ago for timestamps between 1 and 23 hours ago', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');

    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveHoursAgo)).toBe('5h ago');

    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23h ago');
  });

  it('returns days ago for timestamps between 1 and 6 days ago', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');

    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(sixDaysAgo)).toBe('6d ago');
  });

  it('returns localized "MMM D" for timestamps 7 days ago or older', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const expectedSevenDays = sevenDaysAgo.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    expect(formatRelativeTime(sevenDaysAgo.toISOString())).toBe(expectedSevenDays);

    const specificDate = new Date('2025-01-15T12:00:00.000Z');
    const expectedSpecific = specificDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    expect(formatRelativeTime(specificDate.toISOString())).toBe(expectedSpecific);
  });
});
