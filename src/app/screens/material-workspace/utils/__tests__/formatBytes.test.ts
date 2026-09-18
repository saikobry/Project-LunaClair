import { describe, it, expect } from 'vitest';
import { formatBytes } from '../formatBytes';

describe('formatBytes', () => {
  it('keeps sub-kilobyte values in bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('rounds kilobytes to whole units', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(480 * 1024)).toBe('480 KB');
  });

  it('keeps one decimal for megabytes', () => {
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('degrades non-finite and negative input to zero', () => {
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
  });
});
